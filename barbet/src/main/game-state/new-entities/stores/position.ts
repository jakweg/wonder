import EntityId from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import { StoreInitializer } from '@game/new-entities/stores/factory'

const enum Fields {
  X,
  Z,
  SIZE,
}

const PositionStoreCreator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { positions },
  } = init.prepareStorage({
    supportedKinds: [EntityKind.Slime],
    dataBuffers: {
      positions: { internalType: Uint16Array, fieldsPerEntity: Fields.SIZE },
    },
  })

  return {
    read: {
      getPosition(entityId: EntityId): { x: number; z: number } | null {
        if (!isEntitySupported(entityId)) return null

        const x = positions.getValueForEntity_orThrow(entityId, Fields.X)
        const z = positions.getValueForEntity_orThrow(entityId, Fields.Z)

        return { x, z }
      },
    },
    write: {
      setPosition(entityId: EntityId, x: number, y: number): void {
        if (!isEntitySupported(entityId)) return

        positions.setValueForEntity_orThrow(entityId, Fields.X, x)
        positions.setValueForEntity_orThrow(entityId, Fields.Z, y)
      },
    },
  }
}

export default PositionStoreCreator
