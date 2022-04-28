export interface Message {
	'ping': number
	'pong': number
	'successful-join': { yourId: number }
	'leader-change': { newLeaderId: number }
	'player-joined': { playerId: number }
	'player-left': { playerId: number }
}

export type MessageInQueue = { type: keyof Message, value: any }
