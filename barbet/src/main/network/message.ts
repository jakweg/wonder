export interface Message {
	'ping': number
	'pong': number
	'foo': { bar: string }
}

export type MessageInQueue = { type: keyof Message, value: any }
