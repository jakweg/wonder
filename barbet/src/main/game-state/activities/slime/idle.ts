import { ActivityId } from ".."
import { Pose } from "../../../3d-stuff/model/entity/slime/pose"
import { DataOffsetDrawables, DataOffsetWithActivity, EntityTraitIndicesRecord } from "../../entities/traits"
import { GameStateImplementation } from "../../game-state"

import * as slime_jump from './jump'
import * as slime_slowRotate from './slow-rotate'

const JOB_CHECK_INTERVAL_MIN = 50
const JOB_CHECK_INTERVAL_MAX = 250

const enum MemoryField {
    NextJobAttemptTick,
    SIZE,
}

export const setup = (game: GameStateImplementation, unit: EntityTraitIndicesRecord) => {
    const withActivitiesMemory = game.entities.withActivities.rawData
    const drawables = game.entities.drawables.rawData
    const now = game.currentTick

    withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Slime_Idle
    withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now
    withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] = MemoryField.SIZE

    const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
    const memory = game.entities.activitiesMemory.rawData

    const nextJobInterval = game.seededRandom.nextIntRange(JOB_CHECK_INTERVAL_MIN, JOB_CHECK_INTERVAL_MAX)
    memory[pointer - MemoryField.NextJobAttemptTick] = now + nextJobInterval

    drawables[unit.drawable + DataOffsetDrawables.PoseId] = Pose.Idle
}

export const perform = (game: GameStateImplementation, unit: EntityTraitIndicesRecord): void => {
    const withActivitiesMemory = game.entities.withActivities.rawData

    const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
    const memory = game.entities.activitiesMemory.rawData
    const now = game.currentTick
    if (memory[pointer - MemoryField.NextJobAttemptTick]! <= now) {
        if (game.seededRandom.nextInt(2) === 1)
            slime_slowRotate.setup(game, unit)
        else
            slime_jump.setup(game, unit)
    }
}