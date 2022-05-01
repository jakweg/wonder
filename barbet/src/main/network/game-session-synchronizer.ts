import State from '../util/state'
import { globalMutex } from '../worker/global-mutex'
import { setMessageHandler } from '../worker/message-handler'
import { WorkerController } from '../worker/worker-controller'
import { GameLayerMessage } from './message'
import { defaultNetworkState, NetworkStateType } from './network-state'

export interface GameSessionSynchronizer {
	networkState: State<NetworkStateType>

	provideGameStateAsRequested(state: string): void

	terminate(): void
}


export type NetworkEvent =
	{ type: 'game-state-request', from: number }
	| { type: 'game-state-received', value: string }

interface NetworkEnvironmentConfiguration {
	connectToUrl: string

	eventCallback: (event: NetworkEvent) => void
}

export const createRemote = async (config: NetworkEnvironmentConfiguration): Promise<GameSessionSynchronizer> => {
	const mirroredState = State.fromInitial(defaultNetworkState)
	const worker = await WorkerController.spawnNew('network-worker', 'network', globalMutex)

	setMessageHandler('network-state', state => {
		mirroredState.update(state)
	})

	const requestedStateForPlayerIds = new Set<number>()
	setMessageHandler('network-message-received', message => {
		switch (message.type as keyof GameLayerMessage) {
			case 'game-snapshot-request':
				requestedStateForPlayerIds.add(message.origin)
				if (requestedStateForPlayerIds.size === 1)
					config.eventCallback({type: 'game-state-request', from: message.origin})
				break
			case 'game-snapshot':
				config.eventCallback({type: 'game-state-received', value: message.extra.gameState})
				break
			default:
				console.error('Invalid message', message.type)
		}
	})

	worker.replier.send('connect-to', {url: config.connectToUrl, forceEncryption: false})

	await new Promise<void>((resolve, reject) => {
		const cancel = mirroredState.observeEverything(snapshot => {
			if (snapshot['error']) {
				cancel()
				reject()
			} else if (snapshot['status'] === 'joined' && snapshot['error'] === null) {
				cancel()
				resolve()
			}
		}, false)
	})

	if (mirroredState.get('myId') !== mirroredState.get('leaderId')) {
		worker.replier.send('network-worker-dispatch-action', {type: 'set-state-requested', requested: true})
	}

	return {
		networkState: mirroredState,
		provideGameStateAsRequested(state: string) {
			worker.replier.send('network-worker-dispatch-action', {
				type: 'send-state-to-others',
				to: [...requestedStateForPlayerIds.values()],
				gameState: state,
			})
			requestedStateForPlayerIds.clear()
		},
		terminate() {
			worker.terminate()
		},
	}
}
