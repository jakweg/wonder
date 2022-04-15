import { freezeAndValidateOptionsList } from '../../../util/common'
import activityBuilding from '../../game-state/activities/building'
import activityBuildingRoot from '../../game-state/activities/buildingRoot'
import activityIdle from '../../game-state/activities/idle'
import activityItemPickup from '../../game-state/activities/item-pickup'
import activityItemPickupRoot from '../../game-state/activities/item-pickup-root'
import activityMiningResource from '../../game-state/activities/mining-resource/mining-resource'
import activityWalking from '../../game-state/activities/walking'
import activityWalkingByPathRoot from '../../game-state/activities/walking-by-path-root'
import { EntityTraitIndicesRecord } from '../../game-state/entities/traits'
import { GameState } from '../../game-state/game-state'
import { MainRenderer } from '../../main-renderer'
import { RenderContext } from '../render-context'
import { ShaderId } from './unit-shaders'

export enum ActivityId {
	None,
	Idle,
	WalkingByPathRoot,
	Walking,
	ItemPickUpRoot,
	ItemPickUp,
	MiningResource,
	BuildingRoot,
	Building,
}

export interface AdditionalRenderer<T = any, B = any> {
	setup(renderer: MainRenderer, game: GameState): T

	prepareBatch(setup: T, ctx: RenderContext): B

	appendToBatch(setup: T, batch: B, unit: EntityTraitIndicesRecord): void

	executeBatch(setup: T, ctx: RenderContext, batch: B): void
}

export interface ActivityType {
	/** must be between 0 and 255 */
	readonly numericId: ActivityId

	readonly shaderId: ShaderId

	readonly additionalRenderer: AdditionalRenderer | null

	perform(game: GameState, unit: EntityTraitIndicesRecord): void
}


let lazyInitialized = false
const allActivities: ActivityType[] = []

export const requireActivity = (id: ActivityId): ActivityType => {

	const activity = getAllActivities()[id]
	if (activity == null)
		throw new Error(`Invalid activity id ${id}`)
	return activity
}

export const getAllActivities = (): ActivityType[] => {
	if (!lazyInitialized) {
		lazyInitialized = true
		allActivities.push(
			{
				numericId: ActivityId.None,
				shaderId: ShaderId.Stationary,
				additionalRenderer: null,
				perform() {
				},
			},
			activityIdle,
			activityWalkingByPathRoot,
			activityWalking,
			activityItemPickupRoot,
			activityItemPickup,
			activityMiningResource,
			activityBuildingRoot,
			activityBuilding,
		)
		freezeAndValidateOptionsList(allActivities)
	}
	return allActivities
}

