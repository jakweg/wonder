export interface NetworkLayerMessage {
	'ping': number
	'pong': number
	'successful-join': { yourId: number }
	'leader-change': { newLeaderId: number }
	'player-joined': { playerId: number }
	'player-left': { playerId: number }
	'game-layer-message': { broadcast: true, value: GameLayerMessage } | { to: number, value: GameLayerMessage }
}

export type NetworkMessageInQueue = { type: keyof NetworkLayerMessage, value: any }

interface GameLayerMessageType {
	'game-snapshot': { gameState: string }
}

type GameMessageType = keyof GameLayerMessageType

export interface GameLayerMessage<T extends GameMessageType = GameMessageType> {
	type: T
	extra: GameLayerMessageType[T]
}
