import { ActivityId } from ".."
import { Pose } from "../../../3d-stuff/model/entity/slime/pose"
import { Direction } from "../../../util/direction"
import { DataOffsetDrawables, DataOffsetWithActivity, EntityTraitIndicesRecord } from "../../entities/traits"
import { GameStateImplementation } from "../../game-state"
import * as slime_idle from './idle'

const JUMP_DURATION = 20

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


    const oldRotation = drawables[unit.drawable + DataOffsetDrawables.Rotation]! & Direction.MaskCurrentRotation
    const newRotation = game.seededRandom.nextInt(8) & Direction.MaskCurrentRotation

    const shouldCounter = Math.abs(newRotation - oldRotation) > 4
    drawables[unit.drawable + DataOffsetDrawables.Rotation] = newRotation | (oldRotation << Direction.PreviousBitShift) | (shouldCounter ? Direction.RotateCounter : 0)
    drawables[unit.drawable + DataOffsetDrawables.RotationChangeTick] = now & 0xFF
    drawables[unit.drawable + DataOffsetDrawables.PoseId] = Pose.Jumping
}

export const perform = (game: GameStateImplementation, unit: EntityTraitIndicesRecord): void => {
    const withActivitiesMemory = game.entities.withActivities.rawData

    const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
    const memory = game.entities.activitiesMemory.rawData
    const now = game.currentTick
    if (memory[pointer - MemoryField.FinishTick]! <= now) {
        const drawables = game.entities.drawables.rawData
        const oldRotation = drawables[unit.drawable + DataOffsetDrawables.Rotation]! & Direction.MaskCurrentRotation

        drawables[unit.drawable + DataOffsetDrawables.Rotation] = oldRotation | (oldRotation << Direction.PreviousBitShift)

        slime_idle.setup(game, unit)
    }
}