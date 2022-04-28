import { performance } from 'perf_hooks'
import { WebSocketServer } from 'ws'
import { createClientFromSocket } from './client'

const port = 4575

const server = new WebSocketServer({port})
server.addListener('listening', () => {
	console.log(`Server running at port ${port}`)
})

server.addListener('connection', async (socket) => {
	let client
	try {
		client = createClientFromSocket(socket)
	} catch (e) {
		console.error('Failed to create client, dropping connection', e)
		socket.close()
		return
	}
	console.info(`Connected client id=${client.id}`)

	const pingInterval = setInterval(() => {
		socket.send(JSON.stringify({type: 'ping', value: performance.now()}))
	}, 2000)

	try {
		while (true) {
			const message = await client.getMessage()
			if (message.type === 'ping')
				client.send({type: 'pong', value: message.value})
			else if (message.type === 'pong')
				console.log('measured ping', performance.now() - message.value)
			else
				console.log('Unknown message', message)


		}
	} catch (e) {
		console.log(`lost connection with client id=${client.id}:`, e)
	}
	clearInterval(pingInterval)
})

