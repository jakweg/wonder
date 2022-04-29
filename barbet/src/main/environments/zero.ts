import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { Camera } from '../camera'
import { GameState, GameStateImplementation } from '../game-state/game-state'
import { ReceiveActionsQueue } from '../game-state/scheduled-actions/queue'
import {
	createNewStateUpdater,
	createStateUpdaterControllerFromReceived,
	StateUpdater,
} from '../game-state/state-updater'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { putSaveData } from '../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../util/persistance/serializers'
import { setGlobalMutex } from '../worker/global-mutex'
import CONFIG from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { loadGameFromArgs } from '../worker/world-loader'
import {
	ConnectArguments,
	CreateGameArguments,
	EnvironmentConnection,
	SaveGameArguments,
	SaveMethod,
	StartRenderArguments,
	TerminateGameArguments,
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const bind = (args: ConnectArguments): EnvironmentConnection => {
	setGlobalMutex(args.mutex.pass())
	initFrontedVariablesFromReceived(args.frontendVariables)
	setCameraBuffer(args.camera)
	args.settings.observeEverything(s => CONFIG.replace(s))

	let actionsQueue: ReceiveActionsQueue | null = null
	let game: GameState | null = null
	let updater: StateUpdater | null = null
	let renderCancelCallback: any = null
	return {
		name: 'zero',
		async createNewGame(args: CreateGameArguments) {
			const stateBroadcastCallback = () => void 0 // ignore, since everything is locally anyway
			actionsQueue = ReceiveActionsQueue.create()

			game = await loadGameFromArgs(args, actionsQueue!, stateBroadcastCallback) as GameStateImplementation

			const updaterInstance = createNewStateUpdater(() => (game as GameStateImplementation)?.advanceActivities(), game.currentTick)

			updater = createStateUpdaterControllerFromReceived(updaterInstance.pass())
			return {
				state: game,
				updater,
				queue: actionsQueue,
			}
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			if (game === null) throw new Error('Start game first')
			renderCancelCallback?.()
			const gameTickEstimation = () => updater!.estimateCurrentGameTickTime(0)
			renderCancelCallback = startRenderingGame(args.canvas, game, updater!, actionsQueue!, Camera.newUsingBuffer(getCameraBuffer()), gameTickEstimation)
		},
		terminateGame(_: TerminateGameArguments) {
			renderCancelCallback?.()
			updater?.stop()
			actionsQueue = game = updater = null
		},
		saveGame(saveArgs: SaveGameArguments): void {
			if (game === null) return

			const saveName = saveArgs.saveName
			switch (saveArgs.method) {
				case SaveMethod.ToIndexedDatabase: {
					setArrayEncodingType(ArrayEncodingType.Array)
					try {
						void putSaveData(saveName, (game as GameStateImplementation).serialize())
					} finally {
						setArrayEncodingType(ArrayEncodingType.None)
					}
				}
					break
				case SaveMethod.ToString: {
					setArrayEncodingType(ArrayEncodingType.String)
					try {
						const data = JSON.stringify((game as GameStateImplementation).serialize())
						args.feedbackCallback({type: 'saved-to-string', value: data})
					} finally {
						setArrayEncodingType(ArrayEncodingType.None)
					}
				}
					break
				case SaveMethod.ToDataUrl: {
					setArrayEncodingType(ArrayEncodingType.String)
					const asString = JSON.stringify((game as GameStateImplementation).serialize())
					setArrayEncodingType(ArrayEncodingType.None)

					const length = asString.length
					const bytes = new Uint8Array(length)
					for (let i = 0; i < length; i++)
						bytes[i] = asString.charCodeAt(i)!
					const url = URL.createObjectURL(new Blob([bytes]))
					args.feedbackCallback({type: 'saved-to-url', url: url})
				}
			}
		},
	}
}

