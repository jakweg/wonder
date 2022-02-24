import { GameState, Unit } from '../../game-state/game-state'
import { freezeAndValidateOptionsList } from '../../shader/common'
import { ShaderId } from './unit-shaders'

export enum ActivityId {
	None,
	Idle,
	Walking,
	ItemPickup,
	IdleHoldingItem,
	WalkingHoldingItem,
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
	}, {
		numericId: ActivityId.Idle,
		shaderId: ShaderId.Idle,
		perform(game: GameState, unit: Unit) {
			// unit.activityStartedAt = game.currentTick
			const counter = unit.activityMemory[0]!
			if (counter === 0) {
				unit.activityId = ActivityId.Walking
				unit.activityStartedAt = game.currentTick
			} else {
				unit.activityMemory[0] = counter + 1
			}
		},
	}, {
		numericId: ActivityId.Walking,
		shaderId: ShaderId.Walking,
		perform(game: GameState, unit: Unit) {
			const now = game.currentTick
			if (now === unit.activityStartedAt + 15) {
				unit.posX++
				unit.activityStartedAt = now
				if (unit.posX === 9) {
					unit.activityId = ActivityId.ItemPickup
					unit.activityMemory[0] = 0
				}
			}
		},
	}, {
		numericId: ActivityId.ItemPickup,
		shaderId: ShaderId.PickUpItem,
		perform(game: GameState, unit: Unit) {
			const now = game.currentTick
			if (now === unit.activityStartedAt + 10) {
				unit.activityMemory[0] = 0
				unit.activityStartedAt = now
				unit.activityId = ActivityId.IdleHoldingItem
				unit.heldItem = {type: 0}
			}
		},
	}, {
		numericId: ActivityId.IdleHoldingItem,
		shaderId: ShaderId.IdleHoldingItem,
		perform(game: GameState, unit: Unit) {
			const now = game.currentTick
			if (now === unit.activityStartedAt + 50) {
				unit.activityMemory[0] = 0
				unit.activityStartedAt = now
				// unit.activityId = ActivityId.WalkingHoldingItem
			}
		},
	}, {
		numericId: ActivityId.WalkingHoldingItem,
		shaderId: ShaderId.WalkingHoldingItem,
		perform(game: GameState, unit: Unit) {
			const now = game.currentTick
			if (now === unit.activityStartedAt + 15) {
				unit.posZ--
				unit.activityStartedAt = now
				unit.activityId = ActivityId.WalkingHoldingItem
			}
		},
	},
]

freezeAndValidateOptionsList(allActivities)
export const requireActivity = (id: ActivityId): ActivityType => {
	const activity = allActivities[id]
	if (activity == null)
		throw new Error(`Invalid activity id ${id}`)
	return activity
}

export const IDLE = allActivities[ActivityId.Idle]!
