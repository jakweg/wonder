import { WebSocketServer } from 'ws'
import { createClientFromSocket } from './client'

const port = 4575

const server = new WebSocketServer({port})
server.addListener('listening', () => {
	console.log(`Server running at port ${port}`)
})

server.addListener('connection', async (socket) => {
	const client = createClientFromSocket(socket)

	try {
		while (true) {
			const message = await client.getMessage()
			console.log(message)
		}
	} catch (e) {
		console.log('lost connection', e)
	}
})

