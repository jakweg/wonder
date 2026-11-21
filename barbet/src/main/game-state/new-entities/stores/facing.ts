import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'
import { Direction } from '@utils/direction'

const enum Fields {
  PackedFacing,
  SIZE,
}

/**
 * FacingStore packs 3-bit previous Direction (bits 3..5) and 3-bit current Direction (bits 0..2) in a single byte.
 * Shared across rotatable entity kinds.
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { facings },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataBuffers: {
      facings: { internalType: Uint8Array, fieldsPerEntity: Fields.SIZE },
    },
  })

  return {
    read: {
      getFacing(entityId: EntityId): Direction | null {
        if (!isEntitySupported(entityId)) return null

        const packed = facings.getValueForEntity_orThrow(entityId, Fields.PackedFacing)
        return (packed & Direction.MaskCurrentRotation) as Direction
      },
      getPreviousFacing(entityId: EntityId): Direction | null {
        if (!isEntitySupported(entityId)) return null

        const packed = facings.getValueForEntity_orThrow(entityId, Fields.PackedFacing)
        return ((packed >> Direction.PreviousBitShift) & Direction.MaskCurrentRotation) as Direction
      },
      getFacingPacked(entityId: EntityId): number {
        return facings.getValueForEntity_orElse(entityId, Fields.PackedFacing, 0)
      },
    },
    write: {
      setFacing(entityId: EntityId, newDirection: Direction): void {
        if (!isEntitySupported(entityId)) return

        const currentPacked = facings.getValueForEntity_orThrow(entityId, Fields.PackedFacing)
        const previousDirection = currentPacked & Direction.MaskCurrentRotation
        const nextPacked =
          (previousDirection << Direction.PreviousBitShift) | (newDirection & Direction.MaskCurrentRotation)
        facings.setValueForEntity_orThrow(entityId, Fields.PackedFacing, nextPacked)
      },
      snapFacing(entityId: EntityId, direction: Direction): void {
        if (!isEntitySupported(entityId)) return

        const maskedDirection = direction & Direction.MaskCurrentRotation
        const packed = (maskedDirection << Direction.PreviousBitShift) | maskedDirection
        facings.setValueForEntity_orThrow(entityId, Fields.PackedFacing, packed)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        facings.setValueForEntity_orThrow(entityId, Fields.PackedFacing, Direction.PositiveX)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
