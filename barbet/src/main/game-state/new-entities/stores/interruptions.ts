import EntityId from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

export interface Interruption {
  foo: 'bar'
}

/**
 * InterruptionsStore stores pending interruptions per entity
 */
const InterruptionsStoreCreator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { interruptions, },
  } = init.prepareStorage({
    supportedKinds: [EntityKind.Slime],
    dataMaps: {
      interruptions: { } as { value: Interruption },
    },
  })

  return {
    read: {},
    write: {
      sendInterruption(entityId: EntityId, interruption: Interruption): void {
        if (!isEntitySupported(entityId)) return

        interruptions.set(entityId, interruption)
      },
    },
    lifecycle: {
      onEntityAboutToRemove(entityId: EntityId): void {
        interruptions.delete(entityId)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default InterruptionsStoreCreator
