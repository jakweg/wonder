import { GameState, Unit } from '../../game-state/game-state'
import { freezeAndValidateOptionsList } from '../../shader/common'
import { ShaderId } from './unit-shaders'

export enum ActivityId {
	None,
	Idle,
	Walking,
	ItemPickup1,
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
			if (counter === 30) {
				unit.activityId = ActivityId.ItemPickup1
				unit.activityStartedAt = game.currentTick
			} else {
				unit.activityMemory[0] = counter + 1
			}
		},
	}, {
		numericId: ActivityId.Walking,
		shaderId: ShaderId.Walking,
		perform(game: GameState, unit: Unit) {
			// const now = game.currentTick
			// if (now === unit.activityStartedAt + 100) {
			// 	unit.activityStartedAt = now
			// 	unit.activityId = ActivityId.Idle
			// 	unit.activityMemory[0] = 0
			// }
		},
	}, {
		numericId: ActivityId.ItemPickup1,
		shaderId: ShaderId.PickUpItem,
		perform(game: GameState, unit: Unit) {
			const now = game.currentTick
			if (now === unit.activityStartedAt + 10) {
				unit.activityMemory[0] = 0
				unit.activityStartedAt = now
				unit.activityId = ActivityId.Idle
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
