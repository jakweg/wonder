import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'
import { Direction } from '@utils/direction'

export const FACING_TURN_DURATION = 5

const enum Fields {
  PackedFacing,
  SIZE,
}

const enum TickFields {
  StartTick,
  SIZE,
}

/**
 * FacingStore packs 3-bit previous Direction (bits 3..5) and 3-bit current Direction (bits 0..2) in a single byte,
 * paired with a 32-bit facingStartTick so turn interpolation runs on its own clock independent of body animations.
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { facings, facingStartTicks },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataBuffers: {
      facings: { internalType: Uint8Array, fieldsPerEntity: Fields.SIZE },
      facingStartTicks: { internalType: Uint32Array, fieldsPerEntity: TickFields.SIZE },
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
      getFacingStartTick(entityId: EntityId): number {
        return facingStartTicks.getValueForEntity_orElse(entityId, TickFields.StartTick, 0)
      },
    },
    write: {
      setFacing(entityId: EntityId, newDirection: Direction, startTick: number = 0): void {
        if (!isEntitySupported(entityId)) return

        const normalizedTick = startTick >>> 0
        const currentPacked = facings.getValueForEntity_orThrow(entityId, Fields.PackedFacing)
        const currentDirection = currentPacked & Direction.MaskCurrentRotation
        const maskedNewDirection = newDirection & Direction.MaskCurrentRotation

        if (startTick > 0 && maskedNewDirection === currentDirection) {
          const previousStartTick = facingStartTicks.getValueForEntity_orThrow(entityId, TickFields.StartTick)
          if ((normalizedTick - previousStartTick) >>> 0 < FACING_TURN_DURATION) {
            return
          }
        }

        const nextPacked = (currentDirection << Direction.PreviousBitShift) | maskedNewDirection
        facings.setValueForEntity_orThrow(entityId, Fields.PackedFacing, nextPacked)
        facingStartTicks.setValueForEntity_orThrow(entityId, TickFields.StartTick, normalizedTick)
      },
      snapFacing(entityId: EntityId, direction: Direction): void {
        if (!isEntitySupported(entityId)) return

        const maskedDirection = direction & Direction.MaskCurrentRotation
        const packed = (maskedDirection << Direction.PreviousBitShift) | maskedDirection
        facings.setValueForEntity_orThrow(entityId, Fields.PackedFacing, packed)
        facingStartTicks.setValueForEntity_orThrow(entityId, TickFields.StartTick, 0)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        facings.setValueForEntity_orThrow(entityId, Fields.PackedFacing, Direction.PositiveX)
        facingStartTicks.setValueForEntity_orThrow(entityId, TickFields.StartTick, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
