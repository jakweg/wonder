import { createNewStateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { Camera } from '../camera'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { createEmptyGame } from '../worker/example-state-creator'
import SettingsContainer from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { globalMutex, setGlobalGameState, setGlobalStateUpdater } from '../worker/worker-global-state'
import { ConnectArguments, EnvironmentConnection, StartRenderArguments } from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = (args: ConnectArguments): EnvironmentConnection => {
	initFrontedVariablesFromReceived(args.frontendVariables)
	setCameraBuffer(args.camera)
	SettingsContainer.INSTANCE = args.settings

	return {
		name: 'zero',
		async createNewGame() {
			const stateBroadcastCallback = () => void 0 // ignore, since everything is locally anyway
			const game = createEmptyGame(stateBroadcastCallback)
			setGlobalGameState(game)

			const updaterInstance = createNewStateUpdater(globalMutex, game)
			setGlobalStateUpdater(updaterInstance)

			return {
				state: game,
				updater: stateUpdaterFromReceived(globalMutex, updaterInstance.pass()),
			}
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			startRenderingGame(args.canvas, args.game, args.updater, Camera.newUsingBuffer(getCameraBuffer()))
		},
	}
}

