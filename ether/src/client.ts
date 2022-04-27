import { WebSocket } from 'ws'
import { Message } from './message'

type ClientId = number
let nextId = 0
const getNextClientId = (): ClientId => ++nextId

interface Client {
	readonly id: ClientId
	readonly socket: WebSocket
	readonly closePromise: Promise<void>

	getMessage(): Promise<Message>
}

export const createClientFromSocket = (socket: WebSocket): Client => {
	const id = getNextClientId()

	let closed = false

	let currentGetMessagePromise: [any, any, any] | null = null
	const messageQueue: Message[] = []

	socket.addEventListener('message', event => {
		const message = event.data

		const promiseCopy = currentGetMessagePromise
		if (promiseCopy !== null) {
			currentGetMessagePromise = null
			promiseCopy[1](message)
		} else {
			messageQueue.push(message)
		}
	})


	const closePromise = new Promise<void>(resolve => {
		socket.addEventListener('close', () => {
			const promiseCopy = currentGetMessagePromise
			if (promiseCopy !== null) {
				currentGetMessagePromise = null
				promiseCopy[2]('Socket got closed')
			}
			resolve()
		})
	})

	return {
		id, socket, closePromise,
		getMessage(): Promise<Message> {
			if (closed)
				return Promise.reject('Already closed')

			if (messageQueue.length > 0)
				return Promise.resolve(messageQueue.shift())

			if (currentGetMessagePromise !== null)
				return currentGetMessagePromise[0]!

			const promise = new Promise<Message>((resolve, reject) => {
				currentGetMessagePromise = [null, resolve, reject]
			})
			currentGetMessagePromise![0] = promise
			return promise
		},
	}
}
