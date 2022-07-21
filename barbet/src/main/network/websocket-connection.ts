import State from '../util/state'
import { globalMutex } from '../util/worker/global-mutex'
import { spawnNew } from '../util/worker/message-types/network'
import { GameStateAsRequested } from '../util/worker/network-worker-dispatch-action'
import { GameLayerMessage } from './message'
import { defaultNetworkState, NetworkStateType } from './network-state'
import { TickQueueAction } from './tick-queue-action'

export interface WebsocketConnection {
	networkState: State<NetworkStateType>

	broadcastMyActions(tick: number, actions: TickQueueAction[]): void

	broadcastMyActions(tick: number, actions: TickQueueAction[]): void

	provideGameStateAsRequested(forPlayer: number, state: GameStateAsRequested): void

	terminate(): void
}


export type NetworkEvent =
	{ type: 'player-wants-to-become-input-actor', from: number }
	| { type: 'actions-received-from-player', from: number, tick: number, actions: TickQueueAction[] }
	| { type: 'became-input-actor', gameState: GameStateAsRequested, }

interface NetworkEnvironmentConfiguration {
	connectToUrl: string

	eventCallback: (event: NetworkEvent) => void
}

export const createWebsocketConnectionWithServer = async (config: NetworkEnvironmentConfiguration): Promise<WebsocketConnection> => {
	const mirroredState = State.fromInitial(defaultNetworkState)
	const worker = await spawnNew(globalMutex)

	worker.receive.on('network-state', state => {
		mirroredState.update(state)
	})

	worker.receive.on('network-message-received', message => {
		switch (message.type as keyof GameLayerMessage) {
			case 'become-input-actor-request':
				config.eventCallback({ type: 'player-wants-to-become-input-actor', from: message.origin })
				break
			case 'actions-broadcast': {
				const payload = message.extra as GameLayerMessage['actions-broadcast']
				config.eventCallback({
					type: 'actions-received-from-player',
					from: message.origin,
					actions: payload.actions,
					tick: payload.tick,
				})
				break
			}
			case 'become-input-actor-complete': {
				const payload = message.extra as GameLayerMessage['become-input-actor-complete']
				config.eventCallback({
					type: 'became-input-actor',
					gameState: payload.gameState,
				})
				break
			}
			default:
				console.error('Invalid message', message.type)
		}
	})

	worker.send.send('network-worker-dispatch-action', {
		type: 'connect',
		url: config.connectToUrl,
		forceEncryption: false,
	})

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
		worker.send.send('network-worker-dispatch-action', { type: 'request-become-input-actor' })
	}

	return {
		networkState: mirroredState,
		provideGameStateAsRequested(forPlayer, state) {
			worker.send.send('network-worker-dispatch-action', {
				type: 'become-actor-completed',
				to: forPlayer,
				gameState: state,
			})
		},
		broadcastMyActions(tick: number, actions: TickQueueAction[]) {
			worker.send.send('network-worker-dispatch-action', {
				type: 'broadcast-my-actions',
				tick, actions,
			})
		},
		terminate() {
			worker.terminate()
		},
	}
}
