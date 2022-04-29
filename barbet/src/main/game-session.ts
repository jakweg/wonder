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
import { createLocal, createRemote, GameSessionSynchronizer } from './network/game-session-synchronizer'
import SettingsContainer from './worker/observable-settings'

type UpdaterAction = { type: 'resume' | 'change-tick-rate', tickRate: number } | { type: 'pause' }

export interface GameSession {
	resetRendering(): void

	invokeUpdaterAction(action: UpdaterAction): void

	provideStartGameArguments(args: CreateGameArguments): void

	terminate(): void
}

interface Props {
	remoteUrl: string | null

	feedbackCallback: (event: FeedbackEvent) => void

	canvasProvider: () => HTMLCanvasElement
}

export const createSession = async (props: Props): Promise<GameSession> => {
	let terminated: boolean = false
	let synchronizer: GameSessionSynchronizer

	const feedbackMiddleware = (event: FeedbackEvent) => {
		switch (event.type) {
			case 'saved-to-string':
				synchronizer.gameSnapshotCompleted(event.value)
				break
			default:
				props.feedbackCallback(event)
				break
		}
	}

	const suggestedName = getSuggestedEnvironmentName(SettingsContainer.INSTANCE.get('other/preferred-environment') as Environment)
	const environment = await loadEnvironment(suggestedName, feedbackMiddleware)

	let gameState: GameState | null = null
	let updater: StateUpdater | null = null

	if (props.remoteUrl !== null) {
		synchronizer = await createRemote({
			connectToUrl: props.remoteUrl,
			eventCallback: event => {
				switch (event.type) {
					case 'game-state-received':
						loadGameFromArgs({stringToRead: event.value})
						break
					case 'game-state-request':
						if (gameState !== null) {
							environment.saveGame({method: SaveMethod.ToString, saveName: 'requested-by-other-player'})
						}
						break
				}
			},
		})
	} else {
		synchronizer = await createLocal({})
	}

	props.feedbackCallback({type: 'waiting-reason-update', reason: 'waiting-for-leader'})
	props.feedbackCallback({type: 'paused-status-changed', reason: 'not-ready'})

	let wasLeader = false
	let intervalId = setInterval(() => {
		if (terminated) {
			clearInterval(intervalId)
			return
		}


		if (synchronizer.amILeader() && !wasLeader) {
			wasLeader = true
			props.feedbackCallback({type: 'became-session-leader'})
		}
	}, 100)

	const loadGameFromArgs = (args: CreateGameArguments) => {
		props.feedbackCallback({type: 'waiting-reason-update', reason: 'loading-requested-game'})
		environment.createNewGame(args).then((results) => {
			synchronizer.setControlledUpdater(results.updater)
			updater = results.updater
			gameState = results.state
			resetRendering()

			props.feedbackCallback({type: 'waiting-reason-update', reason: 'paused'})
			props.feedbackCallback({type: 'paused-status-changed', reason: 'initial-pause'})
		})
	}


	const resetRendering = () => {
		environment.startRender({
			canvas: props.canvasProvider(),
		})
	}

	return {
		resetRendering,
		provideStartGameArguments(args: CreateGameArguments) {
			queueMicrotask(() => loadGameFromArgs(args))
		},
		invokeUpdaterAction(action: UpdaterAction) {
			queueMicrotask(() => {
				if (terminated)
					return console.warn('terminated')

				if (!synchronizer.amILeader())
					return console.warn('not a leader')

				if (updater === null)
					return console.warn('missing updater')

				switch (action.type) {
					case 'resume':
						updater.start(action.tickRate)
						props.feedbackCallback({type: 'paused-status-changed', reason: 'resumed'})
						break
					case 'change-tick-rate':
						updater.changeTickRate(action.tickRate)
						break
					case 'pause':
						updater.stop()
						props.feedbackCallback({type: 'paused-status-changed', reason: 'user-requested'})
						break
				}
			})
		},
		terminate() {
			terminated = true
			environment.terminateGame({})
			synchronizer.terminate()
		},
	}
}
