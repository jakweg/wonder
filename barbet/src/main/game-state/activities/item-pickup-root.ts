import { Direction, getRotationByChangeInCoords } from '../../util/direction'
import { RequestType } from '../delayed-computer/request'
import { ItemResult } from '../delayed-computer/result'
import {
	DataOffsetDrawables,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTraitIndicesRecord,
} from '../entities/traits'
import { GameState, GameStateImplementation } from '../game-state'
import { ItemType } from '../items'
import { ActivityId } from './index'
import * as activityItemPickup from './item-pickup'
import * as walkingByPathRoot from './walking-by-path-root'

const enum Status {
	Initial,
	RequestedItemSearch,
	RequestedWalk,
}

const enum MemoryField {
	Status,
	RequestId,
	ReturnTo,
	RequestedItemType,
	SIZE,
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord) => {
	const withActivitiesMemory = game.entities.withActivities.rawData
	const memory = game.entities.activitiesMemory.rawData
	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

	switch (memory[pointer - MemoryField.Status]! as Status) {
		case Status.Initial: {
			const positionsData = game.entities.positions.rawData
			const unitX = positionsData[unit.position + DataOffsetPositions.PositionX]!
			const unitZ = positionsData[unit.position + DataOffsetPositions.PositionZ]!

			const itemType = memory[pointer - MemoryField.RequestedItemType]! as ItemType
			const requestId = (game as GameStateImplementation).delayedComputer.request({
				id: 0, type: RequestType.FindItem,
				filterType: itemType,
				searchCenterX: unitX,
				searchCenterZ: unitZ,
			})
			memory[pointer - MemoryField.Status] = Status.RequestedItemSearch
			memory[pointer - MemoryField.RequestId] = requestId
			return
		}
		case Status.RequestedItemSearch: {
			const requestId = memory[pointer - MemoryField.RequestId]!
			const result = (game as GameStateImplementation).delayedComputer.getResult(requestId) as ItemResult
			if (result === null) return
			if (!result.found) break

			memory[pointer - MemoryField.Status] = Status.RequestedWalk
			walkingByPathRoot.setupToRect(game, unit, result.foundAtX, result.foundAtZ, 1)
			return
		}
		case Status.RequestedWalk: {
			const requestId = memory[pointer - MemoryField.RequestId]!
			const result = (game as GameStateImplementation).delayedComputer.getResult(requestId) as ItemResult
			if (result === null || !result.found) break

			const positionsData = game.entities.positions.rawData
			const unitX = positionsData[unit.position + DataOffsetPositions.PositionX]!
			const unitZ = positionsData[unit.position + DataOffsetPositions.PositionZ]!

			if (Math.abs(unitX - result.foundAtX) <= 1 && Math.abs(unitZ - result.foundAtZ) <= 1) {
				const requestedType = memory[pointer - MemoryField.RequestedItemType]! as ItemType
				const actualItemHere = game.groundItems.getItem(result.foundAtX, result.foundAtZ)
				if (actualItemHere === requestedType) {
					const changeX = result.foundAtX - unitX
					const changeZ = result.foundAtZ - unitZ

					const rotation = (changeX !== 0 || changeZ !== 0)
						? getRotationByChangeInCoords(changeX, changeZ)
						: (game.entities.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation]! & Direction.MaskCurrentRotation)
					activityItemPickup.setup(game, unit, rotation, false)
					return
				}
			}
			break
		}
	}

	// path failed or item taken :(
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = memory[pointer - MemoryField.ReturnTo]!
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
}

export const onPickedUp = (game: GameState, unit: EntityTraitIndicesRecord) => {

	const withActivitiesMemory = game.entities.withActivities.rawData
	const memory = game.entities.activitiesMemory.rawData
	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = memory[pointer - MemoryField.ReturnTo]!
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
}

export const setupFindAndPickup = (game: GameState, unit: EntityTraitIndicesRecord, type: ItemType) => {
	if (type === ItemType.None)
		throw new Error('Request of pick up none item')

	const withActivitiesMemory = game.entities.withActivities.rawData
	const memory = game.entities.activitiesMemory.rawData
	const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory

	const returnTo = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId]!
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.ItemPickUpRoot

	memory[pointer - MemoryField.Status] = Status.Initial
	memory[pointer - MemoryField.ReturnTo] = returnTo
	memory[pointer - MemoryField.RequestId] = -1
	memory[pointer - MemoryField.RequestedItemType] = type

}
