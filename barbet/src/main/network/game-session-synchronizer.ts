import State from '../util/state'
import { globalMutex } from '../worker/global-mutex'
import { setMessageHandler } from '../worker/message-handler'
import { WorkerController } from '../worker/worker-controller'
import { GameLayerMessage } from './message'
import { defaultNetworkState, NetworkStateType } from './network-state'
import { TickQueueAction } from './tick-queue-action'

export interface GameSessionSynchronizer {
	networkState: State<NetworkStateType>

	broadcastMyActions(tick: number, actions: TickQueueAction[]): void

	provideGameStateAsRequested(forPlayer: number, inputActorIds: number[], state: string): void

	terminate(): void
}


export type NetworkEvent =
	{ type: 'player-wants-to-become-input-actor', from: number }
	| { type: 'actions-received-from-player', from: number, tick: number, actions: TickQueueAction[] }
	| { type: 'became-input-actor', gameState: string, actorsIds: number[], }

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

	setMessageHandler('network-message-received', message => {
		switch (message.type as keyof GameLayerMessage) {
			case 'become-input-actor-request':
				config.eventCallback({type: 'player-wants-to-become-input-actor', from: message.origin})
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
					actorsIds: payload.actorIds,
				})
				break
			}
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
		worker.replier.send('network-worker-dispatch-action', {type: 'request-become-input-actor'})
	}

	return {
		networkState: mirroredState,
		provideGameStateAsRequested(forPlayer: number, inputActorIds: number[], state: string) {
			worker.replier.send('network-worker-dispatch-action', {
				type: 'become-actor-completed',
				to: forPlayer,
				inputActorIds,
				gameState: state,
			})
		},
		broadcastMyActions(tick: number, actions: TickQueueAction[]) {
			worker.replier.send('network-worker-dispatch-action', {
				type: 'broadcast-my-actions',
				tick, actions,
			})
		},
		terminate() {
			worker.terminate()
		},
	}
}
