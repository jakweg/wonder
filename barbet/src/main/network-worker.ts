import { GameLayerMessage } from './network/message'
import { defaultNetworkState } from './network/network-state'
import { ConnectedSocket, connectToServer, createMessageMiddleware, createMessageReceiver } from './network/socket'
import State from './util/state'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { setGlobalMutex } from './worker/global-mutex'
import { setMessageHandler } from './worker/message-handler'
import CONFIG from './worker/observable-settings'

const connectionWithMainThread = takeControlOverWorkerConnection()
setMessageHandler('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})
setMessageHandler('new-settings', settings => {
	CONFIG.update(settings)
})

let socket: ConnectedSocket
const networkState = State.fromInitial(defaultNetworkState)

type HandlersType = (Parameters<typeof createMessageMiddleware>[2])

const sendGameMessage = <T extends keyof GameLayerMessage>(to: 'leader' | 'broadcast' | number, type: T, extra: GameLayerMessage[T]): void => {
	const effectiveTo = to === 'leader' ? networkState.get('leaderId') : to
	socket?.send('game-layer-message', {
		'to': effectiveTo,
		'extra': {
			type,
			extra,
		},
	})
}

const considerSendWorldRequest = () => {
	if (networkState.get('isRequestingWorld')
		&& networkState.get('myId') !== networkState.get('leaderId')
		&& networkState.get('leaderId') > 0) {
		sendGameMessage('leader', 'game-snapshot-request', {})
	}
}

const handlers: HandlersType = {
	'ping': (socket, value) => {
		socket.send('pong', value)
	},
	'player-left': (_, message) => {
		const playerId = message['playerId']
		networkState.update({
			'joinedPlayerIds': networkState.get('joinedPlayerIds').filter(e => e !== playerId),
		})
	},
	'player-joined': (_, message) => {
		networkState.set('joinedPlayerIds', [...networkState.get('joinedPlayerIds'), message['playerId']])
	},
}

setMessageHandler('network-worker-dispatch-action', (data) => {
	switch (data.type) {
		case 'set-state-requested':
			networkState.set('isRequestingWorld', data.requested)
			break
		case 'send-state-to-others':
			for (const playerId of data.to) {
				sendGameMessage(playerId, 'game-snapshot', {gameState: data.gameState})
			}
			break
	}
})

setMessageHandler('connect-to', async (params) => {
	if (networkState.get('status') !== 'none')
		throw new Error('Already made connection')
	networkState.set('status', 'connecting')

	const url = `ws${params.forceEncryption ? 's' : ''}://${params.url}`

	try {
		socket = await connectToServer(url)
		networkState.set('status', 'connected')

		const receiver = createMessageMiddleware(createMessageReceiver(socket), socket, handlers)

		const message = await receiver()
		if (message.type !== 'successful-join') {
			// noinspection ExceptionCaughtLocallyJS
			throw new Error('Expected successful-join')
		}
		networkState.update({
			'status': 'joined',
			'myId': message['extra']['yourId'],
			'leaderId': message['extra']['leaderId'],
		})

		// noinspection InfiniteLoopJS
		while (true) {
			const message = await receiver()
			switch (message['type']) {
				case 'game-layer-message':
					connectionWithMainThread.send('network-message-received', {
						origin: message['extra']['from'],
						type: message['extra']['extra']['type'],
						extra: message['extra']['extra']['extra'],
					})
					break
				default:
					console.error('unknown message', message['type'], {message})
					socket.close()
					break
			}
		}
	} catch (e) {
		socket?.close()
		console.error('Connection failed')
		networkState.update({
			'error': 'connection failed',
			'status': 'none',
		})
	}
})

networkState.observeEverything(snapshot => {
	connectionWithMainThread.send('network-state', snapshot)
})

networkState.observe('isRequestingWorld', considerSendWorldRequest)


