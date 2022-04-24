import { singleMiningAnimationLoopDuration } from '../../3d-stuff/additional-renderables/hammer'
import { queryBuildingDataById, queryBuildingProgress, updateBuildingProgress } from '../entities/queries'
import { DataOffsetItemHoldable, DataOffsetWithActivity, EntityTraitIndicesRecord } from '../entities/traits'
import { GameState, MetadataField } from '../game-state'
import { ItemType } from '../items'
import { ActivityId } from './index'

const enum MemoryField {
	ReturnTo,
	BuildingId,
	NextHitAt,
	SIZE,
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord) => {
	const memory = game.entities.activitiesMemory.rawData
	const withActivitiesMemory = game.entities.withActivities.rawData
	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

	const hitAt = memory[pointer - MemoryField.NextHitAt]!
	const now = game.currentTick
	if (hitAt !== now)
		return


	const buildingId = memory[pointer - MemoryField.BuildingId]!
	const progress = queryBuildingProgress(game.entities, buildingId)
	if (progress !== null) {
		// can be null if building doesn't exist
		if (progress > 0) {
			// if is zero then building is finished
			updateBuildingProgress(game.entities, buildingId, progress - 1)
			game.metaData[MetadataField.LastBuildingsChange]++
			if (progress > 1) {
				// should still continue building
				memory[pointer - MemoryField.NextHitAt] = now + singleMiningAnimationLoopDuration / 2
				return
			}
		}
	}

	const returnTo = memory[pointer - MemoryField.ReturnTo]!

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = returnTo
}

export const setup = (game: GameState, unit: EntityTraitIndicesRecord, buildingId: number) => {
	const data = queryBuildingDataById(game.entities, buildingId)
	if (data === null) {
		// this building doesn't exist
		return
	}

	if (data.buildingProgress === 0) {
		// no need to rebuild it
		return
	}

	const now = game.currentTick
	const memory = game.entities.activitiesMemory.rawData
	const withActivitiesMemory = game.entities.withActivities.rawData
	const itemHoldables = game.entities.itemHoldables.rawData

	const returnTo = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId]!

	const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory

	itemHoldables[unit.itemHoldable + DataOffsetItemHoldable.ItemId] = ItemType.None
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Building

	memory[pointer - MemoryField.ReturnTo] = returnTo
	memory[pointer - MemoryField.BuildingId] = buildingId
	memory[pointer - MemoryField.NextHitAt] = now + singleMiningAnimationLoopDuration / 2
}

