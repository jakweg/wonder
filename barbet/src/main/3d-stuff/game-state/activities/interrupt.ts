import { Unit } from '../game-state'

export const enum InterruptType {
	/**
	 * No interruption happened, doesn't hold any additional data
	 */
	None,
	/**
	 * Player requested the unit to walk, data is x, z of tile requested to go to
	 */
	WalkRequest
}

export const interruptRequestWalk = (unit: Unit, x: number, z: number) => {
	unit.interrupt[0] = InterruptType.WalkRequest
	unit.interrupt[1] = x
	unit.interrupt[2] = z
}
