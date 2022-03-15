import { SaveGameArguments } from '../environments/loader'

export interface Message {
	['error']: { message: string }
	['connection-established']: { now: number }
	['set-global-mutex']: { mutex: unknown }
	['create-game']: { saveName: string | undefined }
	['set-worker-load-delays']: { update: number, render: number }
	['game-snapshot-for-renderer']: { game: unknown, updater: unknown }
	['transfer-canvas']: { canvas: unknown }
	['frontend-variables']: { buffer: SharedArrayBuffer }
	['update-entity-container']: { buffers: SharedArrayBuffer[] }
	['camera-buffer']: { buffer: SharedArrayBuffer }
	['new-settings']: any
	['save-game']: SaveGameArguments
	['save-game-result']: { url: string }
}

export type MessageType = keyof Message

export interface CombinedMessage<T extends MessageType> {
	type: T
	extra: Message[T]
}

const messageHandlers: { [key in MessageType]?: any } = {}
export const setMessageHandler = <T extends MessageType>(type: T, callback: (data: Message[T], connection: Connection) => void, allowReassign: boolean = false) => {
	if (!allowReassign && messageHandlers[type as MessageType] !== undefined)
		throw new Error(`Reassign handler ${type}`)
	messageHandlers[type as MessageType] = callback
}

export interface Connection {
	send<T extends MessageType>(type: T, extra: Message[T], transferable?: Transferable[]): void
}

export const createMessageHandler = (connection: Connection) => (e: MessageEvent): void => {
	const data = e['data'] as CombinedMessage<MessageType>
	const type = data['type']
	const extra = data['extra']

	const callback = messageHandlers[type]
	if (callback === undefined) {
		if (type !== 'error') {
			const msg = `Unknown message type ${type}`
			console.error(msg, data)
			connection.send('error', {'message': msg})
		}
	} else {
		callback(extra, connection)
	}
}
