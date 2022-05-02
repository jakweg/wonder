import { TickQueueAction } from '../network/tick-queue-action'

export type NetworkWorkerDispatchAction =
	{ type: 'request-become-input-actor' }
	| { type: 'broadcast-my-actions', tick: number, actions: TickQueueAction[] }
	| { type: 'become-actor-completed', gameState: string, to: number[] }
