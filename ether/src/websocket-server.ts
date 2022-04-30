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

const sendCurrentStateToNewPlayer = (player: Player) => {
	for (const other of allPlayers)
		player.client.send('player-joined', {playerId: other.client.id})

	const newLeaderId = allPlayers.find(e => e.isLeader)?.client?.id ?? 0
	player.client.send('leader-change', {newLeaderId})
}

const onClientConnected = (client: Client) => {
	console.info(`Connected client id=${client.id}`)
	const player: Player = {client, isLeader: false}

	player.client.send('successful-join', {yourId: player.client.id})

	sendCurrentStateToNewPlayer(player)

	broadcastToAllPlayers('player-joined', {playerId: player.client.id})

	allPlayers.push(player)
	if (allPlayers.length === 1)
		promoteToLeader(player)

	return player
}


const promoteToLeader = (player: Player) => {
	if (player.isLeader)
		return

	if (allPlayers.find(e => e.isLeader))
		throw new Error('There is already a leader')

	player.isLeader = true
	const newLeaderId = player.client.id

	broadcastToAllPlayers('leader-change', {newLeaderId: newLeaderId})
}

const onClientDisconnected = (client: Client) => {
	const index = allPlayers.findIndex(e => e.client === client)
	if (index < 0)
		throw new Error('Failed to find disconnected client')
	const player = allPlayers[index]!
	allPlayers.splice(index, 1)

	broadcastToAllPlayers('player-left', {playerId: player.client.id})

	if (player.isLeader && allPlayers.length > 0)
		promoteToLeader(allPlayers[0]!)

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

