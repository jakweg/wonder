export interface Message {
	['error']: { message: string }
	['connection-established']: undefined
	['set-global-mutex']: { mutex: unknown }
	['create-game']: undefined
	['game-snapshot-for-renderer']: { game: unknown }
}

export type MessageType = keyof Message

export interface CombinedMessage<T extends MessageType> {
	type: T
	extra: Message[T]
}

const messageHandlers: { [key in MessageType]?: any } = {}
export const setMessageHandler = <T extends MessageType>(type: T, callback: (data: Message[T], connection: Connection) => void) => {
	if (messageHandlers[type as MessageType] !== undefined)
		throw new Error(`Reassign handler ${type}`)
	messageHandlers[type as MessageType] = callback
}

export interface Connection {
	send<T extends MessageType>(type: T, extra: Message[T]): void
}

export const createMessageHandler = (connection: Connection) => (e: MessageEvent): void => {
	const data = e.data as CombinedMessage<MessageType>
	const type = data.type
	const extra = data.extra

	const callback = messageHandlers[type]
	if (callback === undefined) {
		if (type !== 'error') {
			const msg = `Unknown message type ${type}`
			console.error(msg, data)
			connection.send('error', {message: msg})
		}
	} else {
		callback(extra, connection)
	}
}
