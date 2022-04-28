import { connectToServer, createMessageMiddleware, createMessageReceiver } from './network/socket'

type HandlersType = (Parameters<typeof createMessageMiddleware>[2])

const handlers: HandlersType = {
	ping: (socket, value) => {
		socket.send({type: 'pong', value: value})
	},
	pong: (socket, value) => {
		const effectivePing = performance.now() - value
		console.log('got pong', value, effectivePing)
	},
};

(async () => {
	const url = 'ws://localhost:4575'
	try {
		console.log('connecting...')
		const socket = await connectToServer(url)
		const receiver = createMessageMiddleware(createMessageReceiver(socket), socket, handlers)

		socket.send({'type': 'ping', 'value': performance.now()})

		while (true) {
			const message = await receiver()
			console.log('unknown message', {message})
		}

	} catch (e) {
		console.error('Connection failed')
	}
})()
