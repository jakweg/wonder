import { ConnectedSocket, connectToServer, createMessageMiddleware, createMessageReceiver } from './network/socket'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { setGlobalMutex } from './worker/global-mutex'
import { Connection, setMessageHandler } from './worker/message-handler'
import SettingsContainer from './worker/observable-settings'

let connection: Connection
SettingsContainer.INSTANCE = SettingsContainer.createEmpty()
takeControlOverWorkerConnection()
setMessageHandler('set-global-mutex', (data, c) => {
	setGlobalMutex(data.mutex)
	connection = c
})
setMessageHandler('new-settings', settings => {
	SettingsContainer.INSTANCE.update(settings)
})

type HandlersType = (Parameters<typeof createMessageMiddleware>[2])


let socket: ConnectedSocket
let isConnectingOrConnected = false
let myPlayerId: number = -1
let leaderPlayerId: number = -1

let alreadyRequestedGameSnapshot = false
const playerIdsWaitingForGameSnapshot = new Set<number>()

const handlers: HandlersType = {
	ping: (socket, value) => {
		socket.send({'type': 'pong', 'value': value})
	},
	'successful-join': (_, message) => {
		myPlayerId = message.yourId
	},
	'player-left': (_, message) => {
		playerIdsWaitingForGameSnapshot.delete(message.playerId)
	},
	'leader-change': (_, message) => {
		const newLeaderId = message.newLeaderId

		const iWasLeader = leaderPlayerId === myPlayerId
		const iAmLeader = newLeaderId === myPlayerId
		leaderPlayerId = newLeaderId

		if (iWasLeader !== iAmLeader) {
			connection.send('players-update', {nowIAmLeader: iAmLeader})

			if (iAmLeader && playerIdsWaitingForGameSnapshot.size > 0 && !alreadyRequestedGameSnapshot) {
				alreadyRequestedGameSnapshot = true
				connection.send('game-state-request', {})
			}
		}
	},
	'player-joined': (_, message) => {
		console.info('Someone else joined with id', message.playerId)
		const iAmLeader = leaderPlayerId === myPlayerId
		if (iAmLeader && !alreadyRequestedGameSnapshot) {
			console.info('I should send them game snapshot')
			connection.send('game-state-request', {})
			playerIdsWaitingForGameSnapshot.add(message.playerId)
			alreadyRequestedGameSnapshot = true
		}
	},
}

setMessageHandler('game-state-request', (data) => {
	alreadyRequestedGameSnapshot = false
	const iAmLeader = leaderPlayerId === myPlayerId
	if (iAmLeader && playerIdsWaitingForGameSnapshot.size > 0) {
		for (let id of playerIdsWaitingForGameSnapshot.values()) {
			socket.send({
				'type': 'game-layer-message',
				'value': {
					'to': id,
					'value': {type: 'game-snapshot', extra: {gameState: data.gameState}},
				},
			})
		}
		playerIdsWaitingForGameSnapshot.clear()
	}
})

setMessageHandler('connect-to', async (params) => {
	if (isConnectingOrConnected)
		throw new Error('Already made connection')
	isConnectingOrConnected = true

	const url = `ws${params.forceEncryption ? 's' : ''}://${params.url}`

	try {
		socket = await connectToServer(url)
		connection.send('server-connection-update', {connected: true})

		const receiver = createMessageMiddleware(createMessageReceiver(socket), socket, handlers)

		while (true) {
			const message = await receiver()
			switch (message.type) {
				case 'game-layer-message':
					connection.send('network-message-received', message.value)
					break
				default:
					console.error('unknown message', message.type, {message})
					socket.close()
					break
			}
		}

	} catch (e) {
		console.error('Connection failed')
		connection.send('server-connection-update', {connected: false})
	}
	isConnectingOrConnected = false
})



