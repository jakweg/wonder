import activityIdle from '../../game-state/activities/idle'
import activityWalking from '../../game-state/activities/walking'
import activityWalkingByPathRoot from '../../game-state/activities/walking-by-path-root'
import { GameState, Unit } from '../../game-state/game-state'
import { freezeAndValidateOptionsList } from '../../shader/common'
import { ShaderId } from './unit-shaders'

export enum ActivityId {
	None,
	Idle,
	WalkingByPathRoot,
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
		numericId: ActivityId.None,
		shaderId: ShaderId.Stationary,
		perform(_: GameState, __: Unit) {
		},
	},
	activityIdle,
	activityWalkingByPathRoot,
	activityWalking,
]

freezeAndValidateOptionsList(allActivities)
export const requireActivity = (id: ActivityId): ActivityType => {
	const activity = allActivities[id]
	if (activity == null)
		throw new Error(`Invalid activity id ${id}`)
	return activity
}

