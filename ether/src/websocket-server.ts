import { performance } from 'perf_hooks'
import { WebSocketServer } from 'ws'
import { Client, createClientFromSocket } from './client'
import { MessageInQueue } from './message'

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

const broadcastToAllPlayers = (msg: MessageInQueue) => {
	for (const p of allPlayers)
		p.client.send(msg)
}

const onClientConnected = (client: Client) => {
	console.info(`Connected client id=${client.id}`)
	const player: Player = {client, isLeader: false}

	player.client.send({type: 'successful-join', value: {yourId: player.client.id}})

	for (const other of allPlayers)
		player.client.send({type: 'player-joined', value: {playerId: other.client.id}})


	broadcastToAllPlayers({
		type: 'player-joined',
		value: {playerId: player.client.id},
	})

	allPlayers.push(player)
	if (allPlayers.length === 1)
		promoteToLeader(player)
	else {
		broadcastToAllPlayers({
			type: 'leader-change',
			value: {newLeaderId: allPlayers.find(e => e.isLeader)?.client?.id ?? 0},
		})
	}
}


const promoteToLeader = (player: Player) => {
	if (player.isLeader)
		return

	if (allPlayers.find(e => e.isLeader))
		throw new Error('There is already a leader')

	player.isLeader = true
	const newLeaderId = player.client.id

	broadcastToAllPlayers({type: 'leader-change', value: {newLeaderId: newLeaderId}})
}

const onClientDisconnected = (client: Client) => {
	const index = allPlayers.findIndex(e => e.client === client)
	if (index < 0)
		throw new Error('Failed to find disconnected client')
	const player = allPlayers[index]!
	allPlayers.splice(index, 1)

	broadcastToAllPlayers({
		type: 'player-left',
		value: {playerId: player.client.id},
	})

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
		onClientConnected(client)


		while (true) {
			const message = await client.getMessage()
			if (message.type === 'ping')
				client.send({type: 'pong', value: message.value})
			else if (message.type === 'pong')
				console.log('measured ping', performance.now() - message.value)
			else
				console.log('Unknown message', message.type)


		}
	} catch (e) {
		console.log(`lost connection with client id=${client.id}:`, e)
	}

	onClientDisconnected(client)
})

