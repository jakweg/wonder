import { ModelId } from '@3d/model/model-id'
import { GameStateImplementation } from '@game'
import { Direction } from '@utils/direction'
import { ActivityId } from '..'
import { DataOffsetDrawables, DataOffsetWithActivity } from '../../entities/data-offsets'
import { EntityTraitIndicesRecord } from '../../entities/traits'
import { JUMP_DURATION } from './constants'
import * as slime_idle from './idle'
import { lockRotation, setRotation } from './rotate-utils'

const enum MemoryField {
  FinishTick,
  SIZE,
}

export const setup = (game: GameStateImplementation, unit: EntityTraitIndicesRecord) => {
  const now = game.currentTick

  const drawables = game.entities.drawables.rawData
  const withActivitiesMemory = game.entities.withActivities.rawData
  const memory = game.entities.activitiesMemory.rawData

  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentActivityId] = ActivityId.Slime_Jump
  const pointer =
    (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) +
    unit.activityMemory
  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.SuspendUntilTick] = memory[
    pointer - MemoryField.FinishTick
  ] = now + JUMP_DURATION

  const newRotation = game.seededRandom.nextInt(8) & Direction.MaskCurrentRotation
  setRotation(game, unit, newRotation)
  drawables[unit.drawable + DataOffsetDrawables.ModelId] = ModelId.Slime_Jump
}

export const perform = (game: GameStateImplementation, unit: EntityTraitIndicesRecord): void => {
  const withActivitiesMemory = game.entities.withActivities.rawData

  const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
  const memory = game.entities.activitiesMemory.rawData
  const now = game.currentTick
  if (memory[pointer - MemoryField.FinishTick]! <= now) {
    lockRotation(game, unit)
    slime_idle.setup(game, unit)
  }
}
