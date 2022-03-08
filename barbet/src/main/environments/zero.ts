import { createNewStateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { createEmptyGame } from '../worker/example-state-creator'
import { globalMutex, setGlobalGameState, setGlobalStateUpdater } from '../worker/worker-global-state'
import { EnvironmentConnection, StartRenderArguments } from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = (): EnvironmentConnection => {
	return {
		name: 'zero',
		async createNewGame() {
			const game = createEmptyGame()
			setGlobalGameState(game)

			const updaterInstance = createNewStateUpdater(globalMutex, game)
			setGlobalStateUpdater(updaterInstance)

			return {
				state: game,
				updater: stateUpdaterFromReceived(globalMutex, updaterInstance.pass()),
			}
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			startRenderingGame(args.canvas, args.game, args.updater)
		},
	}
}
