import { GameState } from '../3d-stuff/game-state/game-state'
import { createNewStateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { Camera } from '../camera'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { putSaveData } from '../util/persistance/saves-database'
import SettingsContainer from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { globalMutex, setGlobalGameState, setGlobalStateUpdater } from '../worker/worker-global-state'
import { createEmptyGame, loadGameFromDb } from '../worker/world-loader'
import {
	ConnectArguments,
	CreateGameArguments,
	EnvironmentConnection,
	SaveGameArguments,
	StartRenderArguments,
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = (args: ConnectArguments): EnvironmentConnection => {
	initFrontedVariablesFromReceived(args['frontendVariables'])
	setCameraBuffer(args['camera'])
	SettingsContainer.INSTANCE = args['settings']

	let game: GameState
	return {
		'name': 'zero',
		async 'createNewGame'(args: CreateGameArguments) {
			const stateBroadcastCallback = () => void 0 // ignore, since everything is locally anyway

			game = args.saveName === undefined
				? createEmptyGame(stateBroadcastCallback)
				: await loadGameFromDb(args.saveName, stateBroadcastCallback)

			setGlobalGameState(game)

			const updaterInstance = createNewStateUpdater(globalMutex, game)
			setGlobalStateUpdater(updaterInstance)

			return {
				'state': game,
				'updater': stateUpdaterFromReceived(globalMutex, updaterInstance.pass()),
			}
		},
		async 'startRender'(args: StartRenderArguments): Promise<void> {
			startRenderingGame(args['canvas'], args['game'], args['updater'], Camera.newUsingBuffer(getCameraBuffer()))
		},
		'saveGame'(args: SaveGameArguments): void {
			void putSaveData(args.saveName, game.serialize())
		},
	}
}

