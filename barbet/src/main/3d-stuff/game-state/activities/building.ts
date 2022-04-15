import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { queryBuildingDataById } from '../entities/queries'
import { DataOffsetWithActivity, EntityTraitIndicesRecord } from '../entities/traits'
import { GameState } from '../game-state'
import { additionalRenderer } from './mining-resource/additional-renderer'

const enum MemoryField {
	ReturnTo,
	BuildingId,
	SIZE,
}

const activityBuilding = {
	numericId: ActivityId.Building,
	shaderId: ShaderId.MiningResource,
	additionalRenderer: additionalRenderer,
	perform(game: GameState, unit: EntityTraitIndicesRecord) {
		const memory = game.entities.activitiesMemory.rawData
		const withActivitiesMemory = game.entities.withActivities.rawData
		const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

		// const returnTo = memory[pointer - MemoryField.ReturnTo]!
		//
		// withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
		// withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = returnTo
	},
	setup(game: GameState, unit: EntityTraitIndicesRecord, buildingId: number) {
		const data = queryBuildingDataById(game.entities, buildingId)
		if (data === null) {
			// this building doesn't exist
			return
		}

		const memory = game.entities.activitiesMemory.rawData
		const withActivitiesMemory = game.entities.withActivities.rawData

		const returnTo = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId]!

		const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Building

		memory[pointer - MemoryField.ReturnTo] = returnTo
		memory[pointer - MemoryField.BuildingId] = buildingId
	},
}

export default activityBuilding
