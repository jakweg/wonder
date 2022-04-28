import { DEFAULT_NETWORK_SERVER_ADDRESS } from './build-info'
import { connectToServer, createMessageMiddleware, createMessageReceiver } from './network/socket'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { setGlobalMutex } from './worker/global-mutex'
import { setMessageHandler } from './worker/message-handler'
import SettingsContainer from './worker/observable-settings'

SettingsContainer.INSTANCE = SettingsContainer.createEmpty()
takeControlOverWorkerConnection()
setMessageHandler('set-global-mutex', data => {
	setGlobalMutex(data.mutex)
})
setMessageHandler('new-settings', settings => {
	SettingsContainer.INSTANCE.update(settings)
})

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
	const url = 'ws://' + DEFAULT_NETWORK_SERVER_ADDRESS
	try {
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



