import { SaveMethod, SetActionsCallback } from '../entry-points/feature-environments/loader'
import { NetworkStateType } from '../network/network-state'
import { TickQueueAction, TickQueueActionType, UpdaterAction } from '../network/tick-queue-action'
import { createWebsocketConnectionWithServer, NetworkEvent, WebsocketConnection } from '../network/websocket-connection'
import State from '../util/state'
import { GameSession, GenericSessionProps } from './'
import { createGenericSession } from './generic'

interface Props {
	remoteUrl: string
}

export const createRemoteSession = async (props: Props & GenericSessionProps): Promise<GameSession> => {
	let networkState: State<NetworkStateType> | null
	let forwardReceivedActionsCallback: SetActionsCallback | null = null
	let socket: WebsocketConnection
	const temporaryActionsQueue: any[] = []

	const sendActionsToWorld = (tick: number, actions: TickQueueAction[]) => {
		socket.broadcastMyActions(tick, actions)
	}

	const dispatchUpdaterAction = (action: UpdaterAction) => {
		switch (action.type) {
			case 'new-player-joins':
				if (networkState!.get('myId') === networkState!.get('leaderId'))
					generic.dispatchAction({
						type: 'save-game',
						args: {saveName: action.playerId.toString(), method: SaveMethod.ToString},
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
		onGameLoaded: (callback) => {
			forwardReceivedActionsCallback = callback
			for (let action of temporaryActionsQueue)
				forwardReceivedActionsCallback(action[0]!, action[1]!, action[2]!)
		},
		handleFeedbackCallback: (event) => {
			switch (event.type) {
				case 'saved-to-string':
					socket.provideGameStateAsRequested(+event.name, event.inputActorIds, event.serializedState)
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
				if (forwardReceivedActionsCallback !== null)
					forwardReceivedActionsCallback(event.tick, event.from, event.actions)
				else
					temporaryActionsQueue.push([event.tick, event.from, event.actions])
				break
			case 'became-input-actor':
				generic.dispatchAction({
					type: 'create-game',
					args: {stringToRead: event.gameState, existingInputActorIds: event.actorsIds},
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
			props.feedbackCallback({type: 'became-leader'})
	})

	return {
		dispatchAction: generic.dispatchAction,
		resetRendering: generic.resetRendering,
		terminate() {
			generic.terminate()
			socket.terminate()
		},
	}
}
