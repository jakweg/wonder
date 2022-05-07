import { ScheduledAction } from '../game-state/scheduled-actions'

export type UpdaterAction =
	{ type: 'resume', tickRate: number }
	| { type: 'new-player-joins', playerId: number }
	| { type: 'pause' }

export const enum TickQueueActionType {
	GameAction,
	UpdaterAction
}

export type TickQueueAction =
	{ type: TickQueueActionType.GameAction, initiatorId: number, action: ScheduledAction }
	| { type: TickQueueActionType.UpdaterAction, initiatorId: number, action: UpdaterAction }
