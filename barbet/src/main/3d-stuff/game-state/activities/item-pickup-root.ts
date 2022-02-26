import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { GameState, Unit } from '../game-state'
import activityItemPickup from './item-pickup'
import walkingByPathRoot from './walking-by-path-root'

const enum MemoryField {
	ReturnTo,
	DestinationX,
	DestinationZ,
}

const MEMORY_USED_SIZE = 3

const activityItemPickupRoot = {
	numericId: ActivityId.ItemPickUpRoot,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

		const itemX = memory[pointer - MemoryField.DestinationX]!
		const itemZ = memory[pointer - MemoryField.DestinationZ]!

		if (Math.abs(unit.posX - itemX) <= 1 && Math.abs(unit.posZ - itemZ) <= 1) {
			// start picking up this item
			activityItemPickup.setup(game, unit)
		} else {
			// path failed :(
			unit.activityId = memory[pointer - MemoryField.ReturnTo]!
			unit.activityMemoryPointer -= MEMORY_USED_SIZE
		}
	},
	onPickedUp(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

		unit.activityId = memory[pointer - MemoryField.ReturnTo]!
		unit.activityMemoryPointer -= MEMORY_USED_SIZE
	},
	setup(game: GameState, unit: Unit, returnTo: ActivityId, x: number, z: number) {
		unit.activityId = ActivityId.ItemPickUpRoot
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer = unit.activityMemoryPointer + MEMORY_USED_SIZE

		memory[pointer - MemoryField.ReturnTo] = returnTo
		memory[pointer - MemoryField.DestinationX] = x
		memory[pointer - MemoryField.DestinationZ] = z

		walkingByPathRoot.setup(game, unit, ActivityId.ItemPickUpRoot, x, z)
	},
}

export default activityItemPickupRoot
