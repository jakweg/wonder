import GameStatePiece, { PASS, SERIALIZE } from '@game/game-state-piece'
import EntityId, { INVALID_ENTITY_ID } from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import {
  createEntitiesStorageFactory,
  FlattenedMergedStore,
  StoreDescription,
  StoreLifecycle,
} from '@game/new-entities/stores/factory'
import FacingStoreCreator from '@game/new-entities/stores/facing'
import GenerationStoreCreator from '@game/new-entities/stores/generation'
import PositionStoreCreator from '@game/new-entities/stores/position'
import SlimeAnimationStoreCreator from '@game/new-entities/stores/slime-animation'
import SlimeMetadataStoreCreator from '@game/new-entities/stores/slime-metadata'

/** Invoked by GameState at the end of a tick to run removal callbacks and free slots */
export const INTERNAL_REMOVE_MARKED_ENTITIES = Symbol()

type Unpack<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? T[K] // If it's a function, keep it
    : T[K] extends object
      ? Unpack<T[K]> // If it's an object, recurse
      : T[K] // Otherwise, it's a primitive
}

const mergeStores = <T extends StoreDescription<any, any>[], RO extends boolean>(
  readonly: RO,
  ...stores: T
): {
  combined: Unpack<FlattenedMergedStore<RO, T>>
  lifecycle: Required<StoreLifecycle>
} => {
  const combined = {} as any
  const onEntityAllocatedListeners: ((entityId: EntityId) => void)[] = []
  const onEntityAboutToRemoveListeners: ((entityId: EntityId) => void)[] = []

  for (const store of stores) {
    Object.assign(combined, store.read)
    if (!readonly) {
      Object.assign(combined, store.write)
      if (store.lifecycle?.onEntityAllocated) {
        onEntityAllocatedListeners.push(store.lifecycle.onEntityAllocated)
      }
      if (store.lifecycle?.onEntityAboutToRemove) {
        onEntityAboutToRemoveListeners.push(store.lifecycle.onEntityAboutToRemove)
      }
    }
  }

  const lifecycle: Required<StoreLifecycle> = {
    onEntityAllocated(entityId: EntityId) {
      for (const listener of onEntityAllocatedListeners) {
        listener(entityId)
      }
    },
    onEntityAboutToRemove(entityId: EntityId) {
      for (const listener of onEntityAboutToRemoveListeners) {
        listener(entityId)
      }
    },
  }

  return { combined, lifecycle }
}

export const createEntityStore = <RO extends boolean>(
  readonly: RO,
  initArgs: Unpack<Parameters<typeof createEntitiesStorageFactory>[0]>,
) => {
  const init = createEntitiesStorageFactory(initArgs)

  const generationStore = GenerationStoreCreator(init)
  const entitiesMarkedForRemoval = new Set<EntityId>()

  const lifecycleStore = {
    read: {},
    write: {
      /* Spawns new entity, caller must always check if returned ID is not INVALID_ENTITY_ID */
      spawnNewEntitySync(kind: EntityKind): EntityId {
        const entityId = generationStore.internal.allocEntityId(kind)
        if (entityId === INVALID_ENTITY_ID) return INVALID_ENTITY_ID

        lifecycle.onEntityAllocated(entityId)

        return entityId
      },
      /* 
        Marks entity to be removed at the end of this tick
        There is no way to cancel the removal
        Getters and setters will still work normally on this entity until the end of the synchronized part of the tick.
      */
      markEntityForRemoval(entityId: EntityId): void {
        if (!generationStore.read.isEntityAlive(entityId)) return

        entitiesMarkedForRemoval.add(entityId)
      },
      [INTERNAL_REMOVE_MARKED_ENTITIES](): void {
        while (entitiesMarkedForRemoval['size'] > 0) {
          const batch = [...entitiesMarkedForRemoval]
          entitiesMarkedForRemoval.clear()

          for (const entityId of batch) {
            if (!generationStore.read.isEntityAlive(entityId)) continue
            lifecycle.onEntityAboutToRemove(entityId)
          }

          for (const entityId of batch) {
            generationStore.internal.freeEntityId(entityId)
          }
        }
      },
    },
  } satisfies StoreDescription<object, object>

  const { combined, lifecycle } = mergeStores(
    readonly,
    lifecycleStore,
    generationStore,
    PositionStoreCreator(init),
    SlimeMetadataStoreCreator(init),
    FacingStoreCreator(init),
    SlimeAnimationStoreCreator(init),
  )

  return Object.freeze({
    [PASS]() {
      return init[PASS]()
    },
    [SERIALIZE]() {
      return init[SERIALIZE]()
    },
    ...combined,
  }) satisfies GameStatePiece
}

export type GeneralEntityStoreReadonly = ReturnType<typeof createEntityStore<true>>
export type GeneralEntityStore = Unpack<ReturnType<typeof createEntityStore<false>>>