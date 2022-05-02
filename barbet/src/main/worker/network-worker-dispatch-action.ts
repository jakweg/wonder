import { TickQueueAction } from '../network/tick-queue-action'

export type NetworkWorkerDispatchAction =
	{ type: 'request-become-input-actor' }
	| { type: 'broadcast-my-actions', tick: number, actions: TickQueueAction[] }
	| { type: 'become-actor-completed', inputActorIds: number[], gameState: string, to: number }
	| { type: 'connect', url: string, forceEncryption: boolean }
