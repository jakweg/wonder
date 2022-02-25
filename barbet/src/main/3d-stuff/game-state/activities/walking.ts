import { Direction } from '../../../util/path-finder'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { getChangeInXByRotation, getChangeInZByRotation } from '../../shader/common'
import { GameState, Unit } from '../game-state'
import activityWalkingByPathRoot from './walking-by-path-root'

const standardWalkingDuration = 5
const crossWalkingDuration = (standardWalkingDuration * Math.SQRT2) | 0
export const walkingDurationByDirection: number[] = [
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
]
Object.freeze(walkingDurationByDirection)

const activityWalking = {
	numericId: ActivityId.Walking,
	shaderId: ShaderId.Walking,
	perform(game: GameState, unit: Unit) {
		const now = game.currentTick
		if (now === unit.activityMemory[unit.activityMemoryPointer - 2]!) {
			const direction = unit.activityMemory[unit.activityMemoryPointer - 1]!
			unit.posX += getChangeInXByRotation(direction)
			unit.posZ += getChangeInZByRotation(direction)

			unit.activityMemoryPointer -= 2
			unit.activityId = ActivityId.WalkingByPathRoot
			activityWalkingByPathRoot.perform(game, unit)
		}
	},
	startWalking(game: GameState, unit: Unit, direction: Direction) {
		unit.activityStartedAt = game.currentTick
		this.continueWalking(game, unit, direction)
	},
	continueWalking(game: GameState, unit: Unit, direction: Direction) {
		unit.activityId = ActivityId.Walking
		unit.activityStartedAt = game.currentTick
		unit.rotation = direction
		unit.activityMemoryPointer += 2
		unit.activityMemory[unit.activityMemoryPointer - 1] = direction
		unit.activityMemory[unit.activityMemoryPointer - 2] = game.currentTick + walkingDurationByDirection[direction]!
	},
}

export default activityWalking
