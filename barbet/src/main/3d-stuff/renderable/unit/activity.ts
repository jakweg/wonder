import { freezeAndValidateOptionsList } from '../../../util/common'
import activityIdle from '../../game-state/activities/idle'
import activityItemPickup from '../../game-state/activities/item-pickup'
import activityItemPickupRoot from '../../game-state/activities/item-pickup-root'
import activityWalking from '../../game-state/activities/walking'
import activityWalkingByPathRoot from '../../game-state/activities/walking-by-path-root'
import { GameState } from '../../game-state/game-state'
import { UnitTraitIndicesRecord } from '../../game-state/units/units-container'
import { ShaderId } from './unit-shaders'

export enum ActivityId {
	None,
	Idle,
	WalkingByPathRoot,
	Walking,
	ItemPickUpRoot,
	ItemPickUp,
}

export interface ActivityType {
	/** must be between 0 and 255 */
	readonly numericId: ActivityId

	readonly shaderId: ShaderId

	perform(game: GameState, unit: UnitTraitIndicesRecord): void
}


export const allActivities: ActivityType[] = [
	{
		numericId: ActivityId.None,
		shaderId: ShaderId.Stationary,
		perform() {
		},
	},
	activityIdle,
	activityWalkingByPathRoot,
	activityWalking,
	activityItemPickupRoot,
	activityItemPickup,
]

freezeAndValidateOptionsList(allActivities)
export const requireActivity = (id: ActivityId): ActivityType => {
	const activity = allActivities[id]
	if (activity == null)
		throw new Error(`Invalid activity id ${id}`)
	return activity
}

