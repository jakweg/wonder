import { Pose } from '@3d/model/entity/slime/pose'
import { GameStateImplementation } from '@game'
import { ActivityId } from '..'
import { DataOffsetDrawables, DataOffsetWithActivity } from '../../entities/data-offsets'
import { EntityTraitIndicesRecord } from '../../entities/traits'
import { SLOW_ROTATE_DURATION } from './constants'
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

  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentActivityId] = ActivityId.Slime_SlowRotate
  const pointer =
    (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) +
    unit.activityMemory
  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.SuspendUntilTick] = memory[
    pointer - MemoryField.FinishTick
  ] = now + SLOW_ROTATE_DURATION

  setRotation(game, unit, game.seededRandom.nextInt(8))
  drawables[unit.drawable + DataOffsetDrawables.PoseId] = Pose.SlowlyRotating
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
