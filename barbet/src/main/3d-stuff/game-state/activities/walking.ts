import { Direction } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { getChangeInXByRotation, getChangeInZByRotation } from '../../shader/common'
import { GameState, Unit } from '../game-state'
import activityWalkingByPathRoot from './walking-by-path-root'

const standardWalkingDuration = 15
const crossWalkingDuration = (standardWalkingDuration * Math.SQRT2) | 0
export const walkingDurationByDirection: number[] = [
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
]
Object.freeze(walkingDurationByDirection)

const enum MemoryField {
	WalkingFinishTick,
	WalkingDirection,
}

const MEMORY_USED_SIZE = 2

const activityWalking = {
	numericId: ActivityId.Walking,
	shaderId: ShaderId.Walking,
	perform(game: GameState, unit: Unit) {
		const now = game.currentTick
		if (now === unit.activityMemory[unit.activityMemoryPointer - MemoryField.WalkingFinishTick]!) {
			unit.activityMemoryPointer -= MEMORY_USED_SIZE
			unit.activityId = ActivityId.WalkingByPathRoot
			activityWalkingByPathRoot.perform(game, unit)
		}
	},
	tryToContinueWalking(game: GameState, unit: Unit, direction: Direction): boolean {
		const dx = unit.posX + getChangeInXByRotation(direction)
		const dz = unit.posZ + getChangeInZByRotation(direction)
		if (unit.posY !== game.world.getHighestBlockHeight(dx, dz) + 1)
			return false

		unit.posX = dx
		unit.posZ = dz

		const now = game.currentTick
		unit.activityId = ActivityId.Walking
		unit.activityStartedAt = now
		unit.rotation = Direction.FlagMergeWithPrevious | ((unit.rotation & Direction.MaskCurrentRotation) << 3) | direction
		unit.activityMemoryPointer += MEMORY_USED_SIZE
		const memory = unit.activityMemory
		memory[unit.activityMemoryPointer - MemoryField.WalkingDirection] = direction
		memory[unit.activityMemoryPointer - MemoryField.WalkingFinishTick] = now + walkingDurationByDirection[direction]!
		return true
	},
}

export default activityWalking
