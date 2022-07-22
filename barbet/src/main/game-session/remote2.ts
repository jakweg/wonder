import { GameSession, GenericSessionProps } from '.'
import { SaveMethod, SetActionsCallback } from '../entry-points/feature-environments/loader'
import { Status } from '../game-state/state-updater'
import { NetworkStateType } from '../network/network-state'
import { TickQueueAction, TickQueueActionType, UpdaterAction } from '../network/tick-queue-action'
import { createWebsocketConnectionWithServer, NetworkEvent, WebsocketConnection } from '../network/websocket-connection'
import State from '../util/state'
import { createGenericSession } from './generic'

interface Props {
	remoteUrl: string
}

export const createRemoteSession2 = async (props: Props & GenericSessionProps): Promise<GameSession> => {
	let networkState: State<NetworkStateType> | null
	let forwardReceivedActionsCallback: SetActionsCallback | null = null
	let socket: WebsocketConnection
	const temporaryActionsQueue: any[] = []
	let ignoreActionsCallback: boolean = false

	const sendActionsToWorld = (tick: number, actions: TickQueueAction[]) => {
		socket.broadcastMyActions(tick, actions)
	}

	const dispatchUpdaterAction = (action: UpdaterAction) => {
		switch (action.type) {
			case 'new-player-joins':
				if (networkState!.get('myId') === networkState!.get('leaderId'))
					generic.dispatchAction({
						type: 'save-game',
						args: {
							method: SaveMethod.ToString,
							forPlayerId: action.playerId,
							sendPaused: false,
						},
					})
				break
		}
	}

	const generic = await createGenericSession({
		canvasProvider: props.canvasProvider,
		ticksToTakeActionProvider: () => 15,
		myPlayerId: () => networkState!.get('myId'),
		sendActionsToWorld,
		dispatchUpdaterAction,
		onPauseRequested() {
			generic.appendActionForNextTick({
				type: TickQueueActionType.UpdaterAction,
				action: { type: 'pause' },
				initiatorId: networkState!.get('myId'),
			})
		},
		onResumeRequested() {
			const tickRate = generic.getUpdater().getTickRate()
			generic.getUpdater().start(tickRate)
			socket.broadcastMyActions(-1, [{
				type: TickQueueActionType.UpdaterAction,
				action: { type: 'resume', tickRate: tickRate },
				initiatorId: networkState!.get('myId'),
			}])
		},
		onGameLoaded: (callback) => {
			if (ignoreActionsCallback) {
				forwardReceivedActionsCallback = null
			} else {
				forwardReceivedActionsCallback = callback
				for (let action of temporaryActionsQueue)
					callback(action[0]!, action[1]!, action[2]!)
			}
		},
		handleFeedbackCallback: (event) => {
			switch (event.type) {
				case 'saved-to-string':
					const running = generic.getUpdater().getCurrentStatus() === Status.Running
					socket.provideGameStateAsRequested(event.forPlayerId, {
						state: event.serializedState,
						inputActorIds: event.inputActorIds,
						gameSpeed: (!event.sendPaused && running) ? generic.getUpdater().getTickRate() : 0,
						isTemporary: event.sendPaused,
					})
					break
				default:
					props.feedbackCallback(event)
					break
			}
		},
	})

	const eventCallback = (event: NetworkEvent) => {
		const type = event.type
		switch (type) {
			case 'player-wants-to-become-input-actor':
				generic.dispatchAction({
					type: 'save-game',
					args: {
						method: SaveMethod.ToString,
						forPlayerId: event.from,
						sendPaused: true,
					},
				})
				generic.appendActionForNextTick({
					type: TickQueueActionType.UpdaterAction,
					initiatorId: event.from,
					action: {
						type: 'new-player-joins',
						playerId: event.from,
					},
				})
				break
			case 'actions-received-from-player':
				if (event.tick === -1) {
					generic.getUpdater().start(generic.getUpdater().getTickRate())
				} else {
					if (forwardReceivedActionsCallback !== null)
						forwardReceivedActionsCallback(event.tick, event.from, event.actions)
					else
						temporaryActionsQueue.push([event.tick, event.from, event.actions])
				}
				break
			case 'became-input-actor':
				ignoreActionsCallback = event.gameState.isTemporary
				generic.dispatchAction({
					type: 'create-game',
					args: {
						stringToRead: event.gameState.state,
						existingInputActorIds: event.gameState.inputActorIds,
						gameSpeed: event.gameState.gameSpeed,
					},
				})
				break
			default:
				console.warn('Unknown event', type)
				break
		}
	}

	socket = await createWebsocketConnectionWithServer({
		connectToUrl: props.remoteUrl!,
		eventCallback: eventCallback,
	})
	networkState = socket.networkState
	networkState.observe('leaderId', leaderId => {
		const myId = networkState!.get('myId')
		if (myId === leaderId)
			props.feedbackCallback({ type: 'became-leader' })
	})

	return {
		isPaused: generic.isPaused,
		dispatchAction: generic.dispatchAction,
		resetRendering: generic.resetRendering,
		terminate() {
			generic.terminate()
			socket.terminate()
		},
	}
}
