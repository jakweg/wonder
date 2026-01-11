import { createEntitiesStorageFactory, FlattenedMergedStore, StoreDescription } from '@game/new-entities/stores/factory'
import GenerationStoreCreator from '@game/new-entities/stores/generation'
import PositionStoreCreator from '@game/new-entities/stores/position'

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
): Unpack<FlattenedMergedStore<RO, T>> => {
  const combined = {} as any

  for (const store of stores) {
    if (!readonly) {
      Object.assign(combined, store.read)
    }
    Object.assign(combined, store.write)
  }

  return combined
}

export const createEntityStore = <RO extends boolean>(
  readonly: RO,
  initArgs: Unpack<Parameters<typeof createEntitiesStorageFactory>[0]>,
) => {
  const init = createEntitiesStorageFactory(initArgs)

  const combined = mergeStores(readonly, GenerationStoreCreator(init), PositionStoreCreator(init))

  return Object.freeze({
    pass() {
      return init.pass()
    },
    serialize() {
      return init.serialize()
    },
    ...combined,
  })
}

export type GeneralEntityStoreReadonly = ReturnType<typeof createEntityStore<true>>
export type GeneralEntityStore = ReturnType<typeof createEntityStore>
