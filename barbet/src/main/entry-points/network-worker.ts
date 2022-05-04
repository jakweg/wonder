import { GameLayerMessage } from '../network/message'
import { defaultNetworkState } from '../network/network-state'
import { ConnectedSocket, connectToServer, createMessageMiddleware, createMessageReceiver } from '../network/socket'
import CONFIG from '../util/persistance/observable-settings'
import State from '../util/state'
import { takeControlOverWorkerConnection } from '../util/worker/connections-manager'
import { setGlobalMutex } from '../util/worker/global-mutex'

const connectionWithMainThread = takeControlOverWorkerConnection()
connectionWithMainThread.listen('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})
connectionWithMainThread.listen('new-settings', settings => {
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

const handlers: HandlersType = {
	'ping': (socket, value) => {
		socket.send('pong', value)
	},
}

connectionWithMainThread.listen('network-worker-dispatch-action', (data) => {
	const type = data.type
	switch (type) {
		case 'request-become-input-actor':
			sendGameMessage('leader', 'become-input-actor-request', {})
			break
		case 'broadcast-my-actions':
			sendGameMessage('broadcast', 'actions-broadcast', {
				tick: data.tick,
				actions: data.actions,
			})
			break
		case 'become-actor-completed':
			sendGameMessage(data.to, 'become-input-actor-complete', {
				gameState: data.gameState,
				actorIds: data.inputActorIds,
			})
			break
		case 'connect':
			// noinspection JSIgnoredPromiseFromCall
			doConnection(data)
			break
		default:
			console.warn('Unknown action to dispatch', type)
			break
	}
})

const doConnection = async (params: any) => {
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
}

networkState.observeEverything(snapshot => {
	connectionWithMainThread.send('network-state', snapshot)
})
