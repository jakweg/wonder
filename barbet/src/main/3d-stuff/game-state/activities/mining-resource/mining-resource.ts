import { Direction } from '../../../../util/direction'
import { ActivityId } from '../../../renderable/unit/activity'
import { ShaderId } from '../../../renderable/unit/unit-shaders'
import { DataOffsetDrawables, DataOffsetWithActivity, EntityTraitIndicesRecord } from '../../entities/traits'
import { GameState } from '../../game-state'
import itemPickup from '../item-pickup'
import { additionalRenderer, singleMiningAnimationLoopDuration } from './additional-renderer'


const enum MemoryField {
	ActivityFinishTick,
	Direction,
	SIZE,
}

const activityMiningResource = {
	numericId: ActivityId.MiningResource,
	shaderId: ShaderId.MiningResource,
	additionalRenderer: additionalRenderer,
	perform(game: GameState, unit: EntityTraitIndicesRecord) {
		const now = game.currentTick
		const memory = game.entities.activitiesMemory.rawData
		const withActivitiesMemory = game.entities.withActivities.rawData
		const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

		const finishAt = memory[pointer - MemoryField.ActivityFinishTick]!
		if (finishAt !== now) return

		const direction = memory[pointer - MemoryField.Direction]! as Direction
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE

		itemPickup.setup(game, unit, direction, true)
	},
	setup(game: GameState, unit: EntityTraitIndicesRecord, direction: Direction) {
		const now = game.currentTick
		const memory = game.entities.activitiesMemory.rawData
		const withActivitiesMemory = game.entities.withActivities.rawData
		const drawablesData = game.entities.drawables.rawData
		const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.MiningResource

		const oldRotation = drawablesData[unit.drawable + DataOffsetDrawables.Rotation]!
		drawablesData[unit.drawable + DataOffsetDrawables.Rotation] = Direction.FlagMergeWithPrevious | ((oldRotation & Direction.MaskCurrentRotation) << 3) | direction

		memory[pointer - MemoryField.ActivityFinishTick] = now + singleMiningAnimationLoopDuration * 5
		memory[pointer - MemoryField.Direction] = direction
	},
}

export default activityMiningResource
