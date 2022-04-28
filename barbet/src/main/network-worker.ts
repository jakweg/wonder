import { connectToServer, createMessageMiddleware, createMessageReceiver } from './network/socket'
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


let isConnectingOrConnected = false
let myPlayerId: number = -1
let leaderPlayerId: number = -1


const handlers: HandlersType = {
	ping: (socket, value) => {
		socket.send({type: 'pong', value: value})
	},
	pong: (socket, value) => {
		const effectivePing = performance.now() - value
		console.log('got pong', value, effectivePing)
	},
	'successful-join': (_, message) => {
		myPlayerId = message.yourId
	},
	'leader-change': (_, message) => {
		const newLeaderId = message.newLeaderId

		const iWasLeader = leaderPlayerId === myPlayerId
		const iAmLeader = newLeaderId === myPlayerId
		leaderPlayerId = newLeaderId

		if (iWasLeader !== iAmLeader) {
			connection.send('players-update', {nowIAmLeader: iAmLeader})
		}
	},
	'player-joined': (_, message) => {
		console.info('Someone else joined with id', message.playerId)
	},
}


setMessageHandler('connect-to', async (params) => {
	if (isConnectingOrConnected)
		throw new Error('Already made connection')
	isConnectingOrConnected = true

	const url = `ws${params.forceEncryption ? 's' : ''}://${params.url}`

	try {
		const socket = await connectToServer(url)
		connection.send('server-connection-update', {connected: true})

		const receiver = createMessageMiddleware(createMessageReceiver(socket), socket, handlers)

		socket.send({'type': 'ping', 'value': performance.now()})

		while (true) {
			const message = await receiver()
			console.log('unknown message', message.type, {message})
		}

	} catch (e) {
		console.error('Connection failed')
		connection.send('server-connection-update', {connected: false})
	}
	isConnectingOrConnected = false
})



