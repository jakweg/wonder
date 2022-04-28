import { WebSocket } from 'ws'
import { MessageInQueue } from './message'

type ClientId = number
let nextId = 0
const getNextClientId = (): ClientId => ++nextId

export interface Client {
	readonly id: ClientId
	readonly socket: WebSocket
	readonly closePromise: Promise<void>

	send(msg: MessageInQueue): void

	getMessage(): Promise<MessageInQueue>
}

export const createClientFromSocket = (socket: WebSocket): Client => {
	const id = getNextClientId()

	let closed = false

	let currentGetMessagePromise: [any, any, any] | null = null
	const messageQueue: MessageInQueue[] = []

	socket.addEventListener('message', event => {
		const message = event['data']
		if (typeof message !== 'string') {
			socket.close()
			return
		}

		let parsed
		try {
			parsed = JSON.parse(message)
		} catch (e) {
			socket.close()
			return
		}

		const promiseCopy = currentGetMessagePromise
		if (promiseCopy !== null) {
			currentGetMessagePromise = null
			promiseCopy[1](parsed)
		} else {
			messageQueue.push(parsed)
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
		send(msg: MessageInQueue) {
			if (closed)
				console.warn('Socket already closed, dropping unsent message')
			socket.send(JSON.stringify(msg))
		},
		getMessage(): Promise<MessageInQueue> {
			if (closed)
				return Promise.reject('Already closed')

			if (messageQueue.length > 0)
				return Promise.resolve(messageQueue.shift()!)

			if (currentGetMessagePromise !== null)
				return currentGetMessagePromise[0]!

			const promise = new Promise<MessageInQueue>((resolve, reject) => {
				currentGetMessagePromise = [null, resolve, reject]
			})
			currentGetMessagePromise![0] = promise
			return promise
		},
	}
}
