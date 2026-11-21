import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

const enum Fields {
  X,
  Z,
  SIZE,
}

/**
 * PositionStore allows entities to store 16bit integer positions of them self on the map
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { positions },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
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
      getPositionX(entityId: EntityId): number {
        return positions.getValueForEntity_orElse(entityId, Fields.X, 0)
      },
      getPositionZ(entityId: EntityId): number {
        return positions.getValueForEntity_orElse(entityId, Fields.Z, 0)
      },
    },
    write: {
      setPosition(entityId: EntityId, x: number, z: number): void {
        if (!isEntitySupported(entityId)) return

        positions.setValueForEntity_orThrow(entityId, Fields.X, x)
        positions.setValueForEntity_orThrow(entityId, Fields.Z, z)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        positions.setValueForEntity_orThrow(entityId, Fields.X, 0)
        positions.setValueForEntity_orThrow(entityId, Fields.Z, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
