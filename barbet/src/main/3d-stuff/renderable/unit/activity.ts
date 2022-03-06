import { freezeAndValidateOptionsList } from '../../../util/common'
import activityIdle from '../../game-state/activities/idle'
import activityItemPickup from '../../game-state/activities/item-pickup'
import activityItemPickupRoot from '../../game-state/activities/item-pickup-root'
import activityMiningResource from '../../game-state/activities/mining-resource'
import activityWalking from '../../game-state/activities/walking'
import activityWalkingByPathRoot from '../../game-state/activities/walking-by-path-root'
import { EntityTraitIndicesRecord } from '../../game-state/entities/traits'
import { GameState } from '../../game-state/game-state'
import { ShaderId } from './unit-shaders'

export enum ActivityId {
	None,
	Idle,
	WalkingByPathRoot,
	Walking,
	ItemPickUpRoot,
	ItemPickUp,
	MiningResource,
}

export interface ActivityType {
	/** must be between 0 and 255 */
	readonly numericId: ActivityId

	readonly shaderId: ShaderId

	perform(game: GameState, unit: EntityTraitIndicesRecord): void
}


let lazyInitialized = false
const allActivities: ActivityType[] = []

export const requireActivity = (id: ActivityId): ActivityType => {
	if (!lazyInitialized) {
		lazyInitialized = true
		allActivities.push(
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
			activityMiningResource,
		)
		freezeAndValidateOptionsList(allActivities)
	}
	const activity = allActivities[id]
	if (activity == null)
		throw new Error(`Invalid activity id ${id}`)
	return activity
}

