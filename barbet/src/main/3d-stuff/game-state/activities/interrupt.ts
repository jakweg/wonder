import { Unit } from '../game-state'

export const enum InterruptType {
	/**
	 * No interruption happened, doesn't hold any additional data
	 */
	None,
	/**
	 * Player requested the unit to walk, data is x, z of tile requested to go to
	 */
	Walk,
	/**
	 * Player requested the unit to pick up item, data is x, z of tile where the item is located
	 */
	ItemPickUp,
}

export const interruptRequestWalk = (unit: Unit, x: number, z: number) => {
	unit.interrupt[0] = InterruptType.Walk
	unit.interrupt[1] = x
	unit.interrupt[2] = z
}

export const interruptRequestItemPickUp = (unit: Unit, x: number, z: number) => {
	unit.interrupt[0] = InterruptType.ItemPickUp
	unit.interrupt[1] = x
	unit.interrupt[2] = z
}
