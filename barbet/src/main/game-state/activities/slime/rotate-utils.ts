import { GameStateImplementation } from '@game'
import { Direction } from '@utils/direction'
import { EntityTraitIndicesRecord } from '../../entities/traits'
import { DrawableFields } from './constants'

export const setSize = (game: GameStateImplementation, unit: EntityTraitIndicesRecord, newSize: number) => {
  const drawables = game.entities.drawables.rawData

  drawables[unit.drawable + DrawableFields.SlimeSize] = newSize
}

export const setColor = (game: GameStateImplementation, unit: EntityTraitIndicesRecord, color: number) => {
  const drawables = game.entities.drawables.rawData

  drawables[unit.drawable + DrawableFields.ColorR] = (color >> 16) & 0xFF
  drawables[unit.drawable + DrawableFields.ColorG] = (color >> 8) & 0xFF
  drawables[unit.drawable + DrawableFields.ColorB] = (color >> 0) & 0xFF
}

export const setRotation = (game: GameStateImplementation, unit: EntityTraitIndicesRecord, newRotation: Direction) => {
  const drawables = game.entities.drawables.rawData
  const now = game.currentTick

  const oldRotation = drawables[unit.drawable + DrawableFields.Rotation]! & Direction.MaskCurrentRotation

  const shouldCounter = newRotation - oldRotation > 4
  drawables[unit.drawable + DrawableFields.Rotation] =
    newRotation | (oldRotation << Direction.PreviousBitShift) | (shouldCounter ? Direction.RotateCounter : 0)
  drawables[unit.drawable + DrawableFields.RotationChangeTick] = now & 0xff
}

export const lockRotation = (game: GameStateImplementation, unit: EntityTraitIndicesRecord) => {
  const drawables = game.entities.drawables.rawData
  const oldRotation = drawables[unit.drawable + DrawableFields.Rotation]! & Direction.MaskCurrentRotation

  drawables[unit.drawable + DrawableFields.Rotation] = oldRotation | (oldRotation << Direction.PreviousBitShift)
}
