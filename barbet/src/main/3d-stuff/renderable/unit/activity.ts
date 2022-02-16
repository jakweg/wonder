import { GameState, Unit } from '../../game-state/game-state'
import { freezeAndValidateOptionsList } from '../../shader/common'
import { ShaderId } from './unit-shaders'

export enum ActivityId {
	Idle,
	Walking,
}

export interface ActivityType {
	/** must be between 0 and 255 */
	readonly numericId: ActivityId

	readonly shaderId: ShaderId

	perform(game: GameState, unit: Unit): void
}


export const allActivities: ActivityType[] = [
	{
		numericId: ActivityId.Idle,
		shaderId: ShaderId.Idle,
		perform(game: GameState, unit: Unit) {
			const counter = unit.activityMemory[0]!
			if (counter === 60) {
				unit.activityId = ActivityId.Walking
				unit.activityStartedAt = game.currentTick
			} else {
				unit.activityMemory[0] = counter + 1
			}
		},
	},
	{
		numericId: ActivityId.Walking,
		shaderId: ShaderId.Walking,
		perform(game: GameState, unit: Unit) {
			const now = game.currentTick
			if (now === unit.activityStartedAt + 100) {
				unit.activityStartedAt = now
				unit.activityId = ActivityId.Idle
				unit.activityMemory[0] = 0
			}
		},
	},
]

freezeAndValidateOptionsList(allActivities)
export const requireActivity = (id: number): ActivityType => {
	const activity = allActivities[id]
	if (activity == null)
		throw new Error(`Invalid activity id ${id}`)
	return activity
}

export const IDLE = allActivities[ActivityId.Idle]!
