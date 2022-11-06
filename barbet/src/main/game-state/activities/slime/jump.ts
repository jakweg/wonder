import { ActivityId } from ".."
import { Pose } from "../../../3d-stuff/model/entity/slime/pose"
import { Direction } from "../../../util/direction"
import { DataOffsetDrawables, DataOffsetWithActivity, EntityTraitIndicesRecord } from "../../entities/traits"
import { GameStateImplementation } from "../../game-state"
import { JUMP_DURATION } from "./constants"
import * as slime_idle from './idle'
import { lockRotation, setRotation } from "./rotate-utils"


const enum MemoryField {
    FinishTick,
    SIZE,
}

export const setup = (game: GameStateImplementation, unit: EntityTraitIndicesRecord) => {
    const now = game.currentTick

    const drawables = game.entities.drawables.rawData
    const withActivitiesMemory = game.entities.withActivities.rawData
    const memory = game.entities.activitiesMemory.rawData

    withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Slime_Jump
    withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now
    const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory
    memory[pointer - MemoryField.FinishTick] = now + JUMP_DURATION


    const newRotation = game.seededRandom.nextInt(8) & Direction.MaskCurrentRotation
    setRotation(game, unit, newRotation)
    drawables[unit.drawable + DataOffsetDrawables.PoseId] = Pose.Jumping
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