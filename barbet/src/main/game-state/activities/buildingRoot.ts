import { getRotationByChangeInCoords } from '../../util/direction'
import { getBuildingMask } from '../buildings'
import { queryBuildingDataById } from '../entities/queries'
import {
	DataOffsetDrawables,
	DataOffsetItemHoldable,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTrait,
	EntityTraitIndicesRecord,
} from '../entities/traits'
import { GameState } from '../game-state'
import { ItemType } from '../world/item'
import * as activityBuilding from './building'
import { ActivityId } from './index'
import * as activityItemPickRoot from './item-pickup-root'
import * as activityWalkingByPathRoot from './walking-by-path-root'

const enum Status {
	Initial,
	AfterRequestedItem,
	AfterRequestedWalk,
}

const enum MemoryField {
	ReturnTo,
	BuildingId,
	Status,
	SIZE,
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord) => {
	const memory = game.entities.activitiesMemory.rawData
	const withActivitiesMemory = game.entities.withActivities.rawData
	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

	const buildingId = memory[pointer - MemoryField.BuildingId]!
	const status = memory[pointer - MemoryField.Status]! as Status

	switch (status) {
		case Status.Initial: {
			const itemHoldables = game.entities.itemHoldables.rawData
			const hasItem = itemHoldables[unit.itemHoldable + DataOffsetItemHoldable.ItemId] !== ItemType.None

			memory[pointer - MemoryField.Status] = Status.AfterRequestedItem
			if (!hasItem) {
				activityItemPickRoot.setupFindAndPickup(game, unit, ItemType.Box)
			}
			return
		}
		case Status.AfterRequestedItem: {
			const data = queryBuildingDataById(game.entities, buildingId)
			if (data === null) {
				// this building doesn't exist, return to parent activity
				break
			}
			const itemHoldables = game.entities.itemHoldables.rawData
			const hasItem = itemHoldables[unit.itemHoldable + DataOffsetItemHoldable.ItemId] !== ItemType.None
			if (!hasItem) break

			const buildingX = data.position[0]!
			const buildingZ = data.position[2]!

			const mask = getBuildingMask(data.typeId)
			const xHalfMask = 1 + (mask?.sizeX ?? 0) / 2 | 0
			const zHalfMask = 1 + (mask?.sizeZ ?? 0) / 2 | 0
			memory[pointer - MemoryField.Status] = Status.AfterRequestedWalk
			activityWalkingByPathRoot.setup(game, unit, buildingX, buildingZ,
				buildingX - xHalfMask, buildingX + xHalfMask,
				buildingZ - zHalfMask, buildingZ + zHalfMask)
			return
		}
		case Status.AfterRequestedWalk: {
			const data = queryBuildingDataById(game.entities, buildingId)
			if (data === null) {
				// this building doesn't exist, return to parent activity
				break
			}

			const itemHoldables = game.entities.itemHoldables.rawData
			const hasItem = itemHoldables[unit.itemHoldable + DataOffsetItemHoldable.ItemId] !== ItemType.None
			if (!hasItem) break

			const positionsRawData = game.entities.positions.rawData
			const meX = positionsRawData[unit.position + DataOffsetPositions.PositionX]!
			const meZ = positionsRawData[unit.position + DataOffsetPositions.PositionZ]!

			const buildingX = data.position[0]!
			const buildingZ = data.position[2]!

			const mask = getBuildingMask(data.typeId)
			const isWithinBuildingRange = Math.abs(buildingX - meX) <= ((mask?.sizeX ?? 0) / 2 | 0) + 1
				&& Math.abs(buildingZ - meZ) <= ((mask?.sizeZ ?? 0) / 2 | 0) + 1

			if (!isWithinBuildingRange) {
				// outside the building zone, might have failed to find path, return to parent
				break
			}

			// really start building
			const returnTo = memory[pointer - MemoryField.ReturnTo]!
			withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
			withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = returnTo

			if ((unit.thisTraits & EntityTrait.Drawable) === EntityTrait.Drawable) {
				const direction = getRotationByChangeInCoords(Math.sign(buildingX - meX), Math.sign(buildingZ - meZ))
				const drawablesData = game.entities.drawables.rawData
				drawablesData[unit.drawable + DataOffsetDrawables.Rotation] = direction
			}

			activityBuilding.setup(game, unit, buildingId)
			return
		}
	}


	const returnTo = memory[pointer - MemoryField.ReturnTo]!

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = returnTo
}

export const setup = (game: GameState, unit: EntityTraitIndicesRecord, buildingId: number) => {
	const memory = game.entities.activitiesMemory.rawData
	const withActivitiesMemory = game.entities.withActivities.rawData

	const returnTo = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId]!

	const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.BuildingRoot

	memory[pointer - MemoryField.ReturnTo] = returnTo
	memory[pointer - MemoryField.Status] = Status.Initial
	memory[pointer - MemoryField.BuildingId] = buildingId
}
