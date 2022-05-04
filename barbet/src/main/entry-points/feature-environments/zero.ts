import { startRenderingGame } from '../../3d-stuff/renderable/render-context'
import { Camera } from '../../3d-stuff/camera'
import { GameState, GameStateImplementation } from '../../game-state/game-state'
import { ReceiveActionsQueue } from '../../game-state/scheduled-actions/queue'
import {
	createNewStateUpdater,
	createStateUpdaterControllerFromReceived,
	StateUpdater,
} from '../../game-state/state-updater'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import { setGlobalMutex } from '../../util/worker/global-mutex'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { loadGameFromArgs } from '../../game-state/world/world-loader'
import { performGameSave } from '../../game-state/world/world-saver'
import {
	ConnectArguments,
	CreateGameArguments,
	EnvironmentConnection,
	SaveGameArguments,
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
			performGameSave(game, saveArgs, args.feedbackCallback)
		},
	}
}

