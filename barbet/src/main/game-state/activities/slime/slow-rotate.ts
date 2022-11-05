import { ActivityId } from ".."
import { Pose } from "../../../3d-stuff/model/entity/slime/pose"
import { DataOffsetDrawables, DataOffsetWithActivity, EntityTraitIndicesRecord } from "../../entities/traits"
import { GameStateImplementation } from "../../game-state"
import * as slime_idle from './idle'
import { lockRotation, setRotation } from "./rotate-utils"

const SLOW_ROTATE_DURATION = 50

const enum MemoryField {
    FinishTick,
    SIZE,
}

export const setup = (game: GameStateImplementation, unit: EntityTraitIndicesRecord) => {
    const now = game.currentTick

    const drawables = game.entities.drawables.rawData
    const withActivitiesMemory = game.entities.withActivities.rawData
    const memory = game.entities.activitiesMemory.rawData

    withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Slime_SlowRotate
    withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now
    const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory
    memory[pointer - MemoryField.FinishTick] = now + SLOW_ROTATE_DURATION

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