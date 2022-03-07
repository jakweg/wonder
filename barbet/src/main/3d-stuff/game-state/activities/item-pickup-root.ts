import { Direction, getRotationByChangeInCoords } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { ItemType } from '../../world/item'
import {
	DataOffsetDrawables,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTraitIndicesRecord,
} from '../entities/traits'
import { GameState } from '../game-state'
import activityItemPickup from './item-pickup'
import walkingByPathRoot from './walking-by-path-root'

const enum MemoryField {
	ReturnTo,
	DestinationX,
	DestinationZ,
	RequestedItemType,
	SIZE,
}

const activityItemPickupRoot = {
	numericId: ActivityId.ItemPickUpRoot,
	shaderId: ShaderId.Idle,
	additionalRenderer: null,
	perform(game: GameState, unit: EntityTraitIndicesRecord) {
		const withActivitiesMemory = game.entities.withActivities.rawData
		const memory = game.entities.activitiesMemory.rawData
		const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]!

		const itemX = memory[pointer - MemoryField.DestinationX]!
		const itemZ = memory[pointer - MemoryField.DestinationZ]!
		const requestedType = memory[pointer - MemoryField.RequestedItemType]! as ItemType

		const positionsData = game.entities.positions.rawData
		const unitX = positionsData[unit.position + DataOffsetPositions.PositionX]!
		const unitZ = positionsData[unit.position + DataOffsetPositions.PositionZ]!


		if (Math.abs(unitX - itemX) <= 1 && Math.abs(unitZ - itemZ) <= 1) {
			// start picking up this item
			const actualItemHere = game.groundItems.getItem(itemX, itemZ)
			if (actualItemHere === requestedType) {
				const changeX = itemX - unitX
				const changeZ = itemZ - unitZ

				const rotation = (changeX !== 0 || changeZ !== 0)
					? getRotationByChangeInCoords(changeX, changeZ)
					: (game.entities.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation]! & Direction.MaskCurrentRotation)
				activityItemPickup.setup(game, unit, rotation)
				return
			}
		}

		// path failed or item taken :(
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = memory[pointer - MemoryField.ReturnTo]!
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
	},
	onPickedUp(game: GameState, unit: EntityTraitIndicesRecord) {

		const withActivitiesMemory = game.entities.withActivities.rawData
		const memory = game.entities.activitiesMemory.rawData
		const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]!

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = memory[pointer - MemoryField.ReturnTo]!
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
	},
	setup(game: GameState, unit: EntityTraitIndicesRecord, returnTo: ActivityId, x: number, z: number, type: ItemType) {
		if (type === ItemType.None)
			throw new Error('Request of pick up none item')

		const withActivitiesMemory = game.entities.withActivities.rawData
		const memory = game.entities.activitiesMemory.rawData
		const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE)

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.ItemPickUpRoot

		memory[pointer - MemoryField.ReturnTo] = returnTo
		memory[pointer - MemoryField.DestinationX] = x
		memory[pointer - MemoryField.DestinationZ] = z
		memory[pointer - MemoryField.RequestedItemType] = type

		walkingByPathRoot.setup(game, unit, ActivityId.ItemPickUpRoot, x, z, 1)
	},
}

export default activityItemPickupRoot
