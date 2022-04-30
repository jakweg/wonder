import { NetworkLayerMessage, NetworkMessageInQueue } from './message'

export interface ConnectedSocket {
	readonly socket: WebSocket

	send<T extends keyof NetworkLayerMessage>(type: T, extra: NetworkLayerMessage[T]): void

	close(): void
}

export const connectToServer = (url: string): Promise<ConnectedSocket> => {
	const socket = new WebSocket(url)
	return new Promise<ConnectedSocket>((resolve, reject) => {
		socket.addEventListener('error', () => {
			socket['close']()
			reject()
		}, {'once': true})

		socket.addEventListener('close', () => reject(), {'once': true})

		socket.addEventListener('open', () => resolve({
			socket,
			send<T extends keyof NetworkLayerMessage>(type: T, extra: NetworkLayerMessage[T]): void {
				socket['send'](JSON.stringify({'type': type, 'extra': extra}))
			},
			close() {
				socket['close']()
			},
		}), {'once': true})
	})
}
export const createMessageReceiver = <T>(socket: ConnectedSocket)
	: () => Promise<NetworkMessageInQueue> => {

	const messageQueue: NetworkMessageInQueue[] = []
	let currentPromise: [any, any, any] | null = null

	socket.socket.addEventListener('close', () => {
		if (currentPromise !== null)
			currentPromise[2]!()
	}, {'once': true})


	socket.socket.addEventListener('error', () => {
		if (currentPromise !== null)
			currentPromise[2]!()
	}, {'once': true})


	socket.socket.addEventListener('message', (event) => {
		const msg = JSON.parse(event['data']) as NetworkMessageInQueue
		if (currentPromise !== null) {
			const copied = currentPromise
			currentPromise = null
			copied[1](msg)
		} else {
			messageQueue.push(msg)
		}
	})

	return () => {
		if (currentPromise !== null)
			return currentPromise[0]

		if (messageQueue.length > 0)
			return Promise.reject(messageQueue.shift())

		const promise = new Promise<NetworkMessageInQueue>((resolve, reject) => {
			currentPromise = [null, resolve, reject]
		})
		currentPromise![0] = promise
		return promise
	}
}
export const createMessageMiddleware = (receiver: ReturnType<typeof createMessageReceiver>,
                                        socket: ConnectedSocket,
                                        handlers: {
	                                        [key in keyof NetworkLayerMessage]?: (socket: ConnectedSocket,
	                                                                              message: (NetworkLayerMessage[key])) => void
                                        })
	: ReturnType<typeof createMessageReceiver> => {
	return async () => {
		let message

		while (true) {
			message = await receiver()
			const handler = handlers[message['type']]
			if (handler !== undefined)
				handler(socket, message['extra'])
			else
				break
		}

		return message
	}
}
