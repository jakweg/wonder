import { TickQueueAction } from './tick-queue-action'

export interface NetworkLayerMessage {
	'ping': number
	'pong': number
	'successful-join': { yourId: number, leaderId: number, }
	'player-joined': { playerId: number }
	'player-left': { playerId: number }
	'game-layer-message': { to: number | 'broadcast', extra: GameLayerMessageWithType<any> } | { from: number, extra: GameLayerMessageWithType<any> }
}

export type NetworkMessageInQueue = { type: keyof NetworkLayerMessage, extra: any }

export interface GameLayerMessage {
	'become-input-actor-request': {},
	'actions-broadcast': { tick: number, actions: TickQueueAction[] },
	'become-input-actor-complete': { actorIds: number[], gameState: string },
}

export interface GameLayerMessageWithType<T extends keyof GameLayerMessage> {
	'type': T
	'extra': GameLayerMessage[T]
}

export interface ReceivedGameLayerMessage<T extends keyof GameLayerMessage> {
	'type': T
	'extra': GameLayerMessage[T]
	'origin': number
}
