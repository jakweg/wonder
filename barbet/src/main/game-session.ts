import {
	CreateGameArguments,
	Environment,
	FeedbackEvent,
	getSuggestedEnvironmentName,
	loadEnvironment,
	SaveMethod,
	SetActionsCallback,
} from './entry-points/feature-environments/loader'
import { StateUpdater } from './game-state/state-updater'
import { NetworkStateType } from './network/network-state'
import { TickQueueAction, TickQueueActionType, UpdaterAction } from './network/tick-queue-action'
import { createWebsocketConnectionWithServer, NetworkEvent, WebsocketConnection } from './network/websocket-connection'
import CONFIG from './util/persistance/observable-settings'
import State from './util/state'

const TICKS_TO_TAKE_ACTION = 15

type Action =
	{ type: 'create-game', args: CreateGameArguments }
	| { type: 'invoke-updater-action', action: UpdaterAction }

export interface GameSession {
	readonly networkState: State<NetworkStateType>

	resetRendering(): void

	dispatchAction(action: Action): void

	terminate(): void
}

interface Props {
	remoteUrl: string

	feedbackCallback: (event: FeedbackEvent) => void

	canvasProvider: () => HTMLCanvasElement
}

export const createRemoteSession = async (props: Props): Promise<GameSession> => {

	let socket: WebsocketConnection
	let networkState: State<NetworkStateType> | null
	let updater: StateUpdater | null = null
	let forwardReceivedActionsCallback: SetActionsCallback | null = null
	const myActionsForFutureTick: TickQueueAction[] = []
	const temporaryActionsQueue: any[] = []

	const feedbackMiddleware = (event: FeedbackEvent) => {
		switch (event.type) {
			case 'input-action':
				myActionsForFutureTick.push({
					type: TickQueueActionType.GameAction,
					action: event.value,
					initiatorId: networkState!.get('myId'),
				})
				break
			case 'saved-to-string':
				socket.provideGameStateAsRequested(+event.name, event.inputActorIds, event.serializedState)
				break
			case 'tick-completed':
				for (const action of event.updaterActions)
					dispatchUpdaterAction(action)
				socket.broadcastMyActions(event.tick + TICKS_TO_TAKE_ACTION, [...myActionsForFutureTick])
				myActionsForFutureTick.splice(0)
				break
			default:
				props.feedbackCallback(event)
				break
		}
	}

	const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
	const environment = await loadEnvironment(suggestedName, feedbackMiddleware)


	const eventCallback = (event: NetworkEvent) => {
		const type = event.type
		switch (type) {
			case 'player-wants-to-become-input-actor':
				myActionsForFutureTick.push({
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
				loadGameFromArgs({stringToRead: event.gameState, existingInputActorIds: event.actorsIds})
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

	const loadGameFromArgs = (args: CreateGameArguments) => {
		const existingPlayerIds = args.existingInputActorIds ?? [networkState!.get('myId')]
		environment.createNewGame({
			...args,
			existingInputActorIds: existingPlayerIds,
		}).then((results) => {
			updater = results.updater
			forwardReceivedActionsCallback = results.setActionsCallback
			for (const element of temporaryActionsQueue)
				forwardReceivedActionsCallback(element[0]!, element[1]!, element[2]!)

			environment.startRender({canvas: props.canvasProvider()})
			resumeGame(20)
		})
	}

	const resumeGame = (tickRate: number) => {
		if (updater !== null) {
			const lastTick = updater.getExecutedTicksCount()
			for (let i = 0; i < TICKS_TO_TAKE_ACTION; i++)
				socket.broadcastMyActions(lastTick + i + 1, [])

			updater.start(tickRate)
		}
	}

	const dispatchUpdaterAction = (action: UpdaterAction) => {
		if (updater === null) return
		switch (action.type) {
			case 'new-player-joins':
				if (networkState!.get('myId') === networkState!.get('leaderId'))
					environment.saveGame({saveName: action.playerId.toString(), method: SaveMethod.ToString})
				break
			case 'resume':
				resumeGame(action.tickRate)
				break
		}
	}

	return {
		networkState: networkState,
		dispatchAction(action: Action) {
			queueMicrotask(async () => {
				switch (action.type) {
					case 'create-game':
						loadGameFromArgs(action.args)
						break
					case 'invoke-updater-action':
						dispatchUpdaterAction(action.action)
						break
				}
			})
		},
		resetRendering() {
			environment.startRender({canvas: props.canvasProvider()})
		},
		terminate() {
			environment.terminateGame({})
			socket.terminate()
		},
	}
}
