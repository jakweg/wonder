import {
	CreateGameArguments,
	Environment,
	FeedbackEvent,
	getSuggestedEnvironmentName,
	loadEnvironment,
	SaveMethod,
} from './environments/loader'
import { GameState } from './game-state/game-state'
import { StateUpdater } from './game-state/state-updater'
import { createRemote, GameSessionSynchronizer, NetworkEvent } from './network/game-session-synchronizer'
import { NetworkStateType } from './network/network-state'
import State from './util/state'
import CONFIG from './worker/observable-settings'

const defaultSessionState = {
	'terminated': false,
	'world-status': 'none' as ('none' | 'creating' | 'loaded'),
}

type UpdaterAction = { type: 'resume' | 'change-tick-rate', tickRate: number } | { type: 'pause' }

type Action =
	{ type: 'create-game', args: CreateGameArguments }
	| { type: 'invoke-updater-action', action: UpdaterAction }

export interface GameSession {
	readonly sessionState: State<typeof defaultSessionState>

	readonly networkState: State<NetworkStateType>

	resetRendering(): void

	dispatchAction(action: Action): void

	terminate(): void
}

interface Props {
	remoteUrl: string | null

	feedbackCallback: (event: FeedbackEvent) => void

	canvasProvider: () => HTMLCanvasElement
}

export const createSession = async (props: Props): Promise<GameSession> => {
	if (props.remoteUrl === null)
		throw new Error('Local not supported')

	const sessionState = State.fromInitial(defaultSessionState)

	let synchronizer: GameSessionSynchronizer

	const feedbackMiddleware = (event: FeedbackEvent) => {
		switch (event.type) {
			case 'saved-to-string':
				synchronizer.provideGameStateAsRequested(event.value)
				break
			default:
				props.feedbackCallback(event)
				break
		}
	}

	const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
	const environment = await loadEnvironment(suggestedName, feedbackMiddleware)

	let networkState: State<NetworkStateType> | null = null
	let gameState: GameState | null = null
	let updater: StateUpdater | null = null


	const eventCallback = (event: NetworkEvent) => {
		switch (event.type) {
			case 'game-state-received':
				loadGameFromArgs({stringToRead: event.value})
				break
			case 'game-state-request':
				if (gameState !== null)
					environment.saveGame({method: SaveMethod.ToString, saveName: 'requested-by-other-player'})
				break
		}
	}

	synchronizer = await createRemote({
		connectToUrl: props.remoteUrl!,
		eventCallback: eventCallback,
	})
	networkState = synchronizer.networkState

	const loadGameFromArgs = (args: CreateGameArguments) => {
		sessionState.set('world-status', 'creating')
		environment.createNewGame(args).then((results) => {
			updater = results.updater
			gameState = results.state
			resetRendering()
			sessionState.set('world-status', 'loaded')
		})
	}

	const resetRendering = () => {
		environment.startRender({canvas: props.canvasProvider()})
	}

	const dispatchUpdaterAction = (action: UpdaterAction) => {
		if (updater === null) return
		switch (action.type) {
			case 'resume':
				updater.start(action.tickRate)
				break
			case 'change-tick-rate':
				updater.changeTickRate(action.tickRate)
				break
			case 'pause':
				updater.stop()
				break
		}
	}

	return {
		sessionState: sessionState,
		networkState: networkState,
		resetRendering,
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
		// provideStartGameArguments(args: CreateGameArguments) {
		// 	queueMicrotask(() => loadGameFromArgs(args))
		// },
		// invokeUpdaterAction(action: UpdaterAction) {
		// 	queueMicrotask(() => {
		// 		if (terminated)
		// 			return console.warn('terminated')
		//
		// 		if (updater === null)
		// 			return console.warn('missing updater')
		//
		//
		// 	})
		// },
		terminate() {
			sessionState.update({
				'terminated': true,
				'world-status': 'none',
			})
			environment.terminateGame({})
			synchronizer.terminate()
		},
	}
}
