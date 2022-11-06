import { Direction } from '../../../util/direction'
import { DataOffsetDrawables, EntityTraitIndicesRecord } from '../../entities/traits'
import { GameStateImplementation } from '../../game-state'

export const setRotation = (game: GameStateImplementation, unit: EntityTraitIndicesRecord, newRotation: Direction) => {
  const drawables = game.entities.drawables.rawData
  const now = game.currentTick

  const oldRotation = drawables[unit.drawable + DataOffsetDrawables.Rotation]! & Direction.MaskCurrentRotation

  const shouldCounter = newRotation - oldRotation > 4
  drawables[unit.drawable + DataOffsetDrawables.Rotation] =
    newRotation | (oldRotation << Direction.PreviousBitShift) | (shouldCounter ? Direction.RotateCounter : 0)
  drawables[unit.drawable + DataOffsetDrawables.RotationChangeTick] = now & 0xff
}

export const lockRotation = (game: GameStateImplementation, unit: EntityTraitIndicesRecord) => {
  const drawables = game.entities.drawables.rawData
  const oldRotation = drawables[unit.drawable + DataOffsetDrawables.Rotation]! & Direction.MaskCurrentRotation

  drawables[unit.drawable + DataOffsetDrawables.Rotation] = oldRotation | (oldRotation << Direction.PreviousBitShift)
}
