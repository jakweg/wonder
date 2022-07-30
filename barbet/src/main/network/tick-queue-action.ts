import { ScheduledAction } from '../game-state/scheduled-actions'

export type UpdaterAction =
	{ type: 'resume', tickRate: number }
	| { type: 'pause' }

export const enum TickQueueActionType {
	GameAction,
	UpdaterAction
}

export type TickQueueAction =
	{ type: TickQueueActionType.GameAction, action: ScheduledAction }
	| { type: TickQueueActionType.UpdaterAction, action: UpdaterAction }
