import { TickQueueAction } from '../../network/tick-queue-action'

export interface GameStateAsRequested {
	inputActorIds: number[]
	gameSpeed: number
	state: string
	isTemporary: boolean
}

export type NetworkWorkerDispatchAction =
	{ type: 'request-become-input-actor' }
	| { type: 'broadcast-my-actions', tick: number, actions: TickQueueAction[] }
	| { type: 'become-actor-completed', gameState: GameStateAsRequested, to: number }
	| { type: 'connect', url: string, forceEncryption: boolean }
