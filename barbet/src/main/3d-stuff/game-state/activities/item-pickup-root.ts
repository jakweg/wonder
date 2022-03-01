import { Direction, getRotationByChangeInCoords } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { ItemType } from '../../world/item'
import { GameState, Unit } from '../game-state'
import activityItemPickup from './item-pickup'
import walkingByPathRoot from './walking-by-path-root'

const enum MemoryField {
	ReturnTo,
	DestinationX,
	DestinationZ,
	RequestedItemType,
}

const MEMORY_USED_SIZE = 4

const activityItemPickupRoot = {
	numericId: ActivityId.ItemPickUpRoot,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

		const itemX = memory[pointer - MemoryField.DestinationX]!
		const itemZ = memory[pointer - MemoryField.DestinationZ]!
		const requestedType = memory[pointer - MemoryField.RequestedItemType]! as ItemType

		if (Math.abs(unit.posX - itemX) <= 1 && Math.abs(unit.posZ - itemZ) <= 1) {
			// start picking up this item
			const actualItemHere = game.groundItems.getItem(itemX, itemZ)
			if (actualItemHere === requestedType) {
				const changeX = itemX - unit.posX
				const changeZ = itemZ - unit.posZ
				const rotation = (changeX !== 0 || changeZ !== 0) ? getRotationByChangeInCoords(changeX, changeZ) : (unit.rotation & Direction.MaskCurrentRotation)
				activityItemPickup.setup(game, unit, rotation)
				return
			}
		}

		// path failed or item taken :(
		unit.activityId = memory[pointer - MemoryField.ReturnTo]!
		unit.activityMemoryPointer -= MEMORY_USED_SIZE
	},
	onPickedUp(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

		unit.activityId = memory[pointer - MemoryField.ReturnTo]!
		unit.activityMemoryPointer -= MEMORY_USED_SIZE
	},
	setup(game: GameState, unit: Unit, returnTo: ActivityId, x: number, z: number, type: ItemType) {
		if (type === ItemType.None)
			throw new Error('Request of pick up none item')

		unit.activityId = ActivityId.ItemPickUpRoot
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer = unit.activityMemoryPointer + MEMORY_USED_SIZE

		memory[pointer - MemoryField.ReturnTo] = returnTo
		memory[pointer - MemoryField.DestinationX] = x
		memory[pointer - MemoryField.DestinationZ] = z
		memory[pointer - MemoryField.RequestedItemType] = type

		walkingByPathRoot.setup(game, unit, ActivityId.ItemPickUpRoot, x, z, 1)
	},
}

export default activityItemPickupRoot
