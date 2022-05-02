import { ScheduledAction } from '../game-state/scheduled-actions'

export type UpdaterAction =
	{ type: 'resume' | 'change-tick-rate', tickRate: number }
	| { type: 'pause' }
	| { type: 'new-player-joins', playerId: number }

export const enum TickQueueActionType {
	GameAction,
	UpdaterAction
}

export type TickQueueAction =
	{ type: TickQueueActionType.GameAction, action: ScheduledAction }
	| { type: TickQueueActionType.UpdaterAction, action: UpdaterAction }
