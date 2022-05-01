import { performance } from 'perf_hooks'
import { WebSocketServer } from 'ws'
import { Client, createClientFromSocket } from './client'
import { Message } from './message'

const port = 4575

const server = new WebSocketServer({port})
server.addListener('listening', () => {
	console.log(`Server running at port ${port}`)
})

interface Player {
	isLeader: boolean
	readonly client: Client
}

const allPlayers: Player[] = []

const broadcastToAllPlayers = <T extends keyof Message>(type: T, extra: Message[T]) => {
	for (const p of allPlayers)
		p.client.send(type, extra)
}

const onClientConnected = (client: Client) => {
	console.info(`Connected client id=${client.id}`)

	const shouldBecomeLeader = allPlayers.length === 0

	const player: Player = {client, isLeader: shouldBecomeLeader}

	const leaderId = shouldBecomeLeader ? player.client.id : allPlayers.find(e => e.isLeader)?.client?.id ?? -1
	player.client.send('successful-join', {yourId: player.client.id, leaderId})
	for (const other of allPlayers)
		player.client.send('player-joined', {playerId: other.client.id})

	broadcastToAllPlayers('player-joined', {playerId: player.client.id})

	allPlayers.push(player)

	return player
}

const onClientDisconnected = (client: Client) => {
	const index = allPlayers.findIndex(e => e.client === client)
	if (index < 0)
		throw new Error('Failed to find disconnected client')
	const player = allPlayers[index]!
	allPlayers.splice(index, 1)

	broadcastToAllPlayers('player-left', {playerId: player.client.id})

	if (player.isLeader && allPlayers.length > 0) {
		console.info('Leader disconnected, dropping other players')
		for (const p of allPlayers)
			p.client.socket.close()
	}

}

server.addListener('connection', async (socket) => {
	let client
	try {
		client = createClientFromSocket(socket)
	} catch (e) {
		console.error('Failed to create client, dropping connection', e)
		socket.close()
		return
	}

	try {
		const player = onClientConnected(client)


		// noinspection InfiniteLoopJS
		while (true) {
			const message = await client.getMessage()
			switch (message.type) {
				case 'ping':
					client.send('pong', message.extra)
					break
				case 'pong':
					console.log('measured ping', performance.now() - message.extra)
					break
				case 'game-layer-message':
					const forwardTo = message.extra.to
					console.log('forward', player.client.id, '->', forwardTo, 'of type', message.extra?.extra?.type)
					if (typeof forwardTo === 'number') {
						allPlayers.find(e => e.client.id === forwardTo)
							?.client?.send('game-layer-message', {
							from: client.id, extra: message.extra.extra,
						})
					} else {
						console.log('invalid forward to value', {forwardTo})
					}
					break
				default:
					console.log('Unknown message', message.type)
					break
			}
		}
	} catch (e) {
		console.log(`lost connection with client id=${client.id}:`, e)
	}

	onClientDisconnected(client)
})

