import { Pose } from '@3d/model/entity/slime/pose'
import { ModelId } from '@3d/model/model-id'
import { GameStateImplementation } from '@game'
import { ActivityId } from '..'
import { DataOffsetDrawables, DataOffsetWithActivity } from '../../entities/data-offsets'
import { EntityTraitIndicesRecord } from '../../entities/traits'
import {
  IDLE_JOB_CHECK_INTERVAL_MAX,
  IDLE_JOB_CHECK_INTERVAL_MIN,
  JOB_CHANCE_TO_JUMP_INSTEAD_OF_JUST_ROTATE,
} from './constants'

import * as slime_jump from './jump'
import * as slime_slowRotate from './slow-rotate'

const enum MemoryField {
  NextJobAttemptTick,
  SIZE,
}

export const setup = (game: GameStateImplementation, unit: EntityTraitIndicesRecord) => {
  const withActivitiesMemory = game.entities.withActivities.rawData
  const drawables = game.entities.drawables.rawData
  const now = game.currentTick

  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentActivityId] = ActivityId.Slime_Idle
  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] = MemoryField.SIZE

  const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
  const memory = game.entities.activitiesMemory.rawData

  const nextJobInterval = game.seededRandom.nextIntRange(IDLE_JOB_CHECK_INTERVAL_MIN, IDLE_JOB_CHECK_INTERVAL_MAX)
  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.SuspendUntilTick] = memory[
    pointer - MemoryField.NextJobAttemptTick
  ] = now + nextJobInterval

  drawables[unit.drawable + DataOffsetDrawables.ModelId] = ModelId.Slime_Idle
}

export const perform = (game: GameStateImplementation, unit: EntityTraitIndicesRecord): void => {
  const withActivitiesMemory = game.entities.withActivities.rawData

  const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
  const memory = game.entities.activitiesMemory.rawData
  const now = game.currentTick
  if (memory[pointer - MemoryField.NextJobAttemptTick]! <= now) {
    if (game.seededRandom.nextInt(100) < JOB_CHANCE_TO_JUMP_INSTEAD_OF_JUST_ROTATE) slime_jump.setup(game, unit)
    else slime_slowRotate.setup(game, unit)
  }
}
