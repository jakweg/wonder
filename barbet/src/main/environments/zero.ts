import { GameState } from '../3d-stuff/game-state/game-state'
import { createNewStateUpdater, StateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { Camera } from '../camera'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { putSaveData } from '../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../util/persistance/serializers'
import SettingsContainer from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { globalMutex, setGlobalGameState, setGlobalStateUpdater } from '../worker/worker-global-state'
import { createEmptyGame, loadGameFromDb, loadGameFromFile } from '../worker/world-loader'
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
export const connect = (args: ConnectArguments): EnvironmentConnection => {
	initFrontedVariablesFromReceived(args['frontendVariables'])
	setCameraBuffer(args['camera'])
	SettingsContainer.INSTANCE = args['settings']

	let game: GameState | null = null
	let updater: StateUpdater | null = null
	let renderCancelCallback: any = null
	return {
		'name': 'zero',
		async 'createNewGame'(args: CreateGameArguments) {
			const stateBroadcastCallback = () => void 0 // ignore, since everything is locally anyway

			const saveName = args['saveName']
			const file = args['fileToRead']
			game = file !== undefined
				? await loadGameFromFile(file, stateBroadcastCallback)
				: (saveName !== undefined
					? await loadGameFromDb(saveName, stateBroadcastCallback)
					: createEmptyGame(stateBroadcastCallback))

			setGlobalGameState(game)

			const updaterInstance = createNewStateUpdater(globalMutex, game)
			setGlobalStateUpdater(updaterInstance)

			updater = stateUpdaterFromReceived(globalMutex, updaterInstance.pass())
			return {
				'state': game,
				'updater': updater,
			}
		},
		async 'startRender'(args: StartRenderArguments): Promise<void> {
			if (game === null) throw new Error('Start game first')
			renderCancelCallback?.()
			renderCancelCallback = startRenderingGame(args['canvas'], game, updater!, Camera.newUsingBuffer(getCameraBuffer()))
		},
		'terminateGame'(_: TerminateGameArguments) {
			renderCancelCallback?.()
			updater?.stop()
			game = updater = null
			setGlobalStateUpdater(null)
			setGlobalGameState(null)
		},
		'saveGame'(saveArgs: SaveGameArguments): void {
			if (game === null) return

			const saveName = saveArgs['saveName']
			switch (saveArgs['method']) {
				case SaveMethod.ToIndexedDatabase: {
					setArrayEncodingType(ArrayEncodingType.AsArray)
					try {
						void putSaveData(saveName, game.serialize())
					} finally {
						setArrayEncodingType(ArrayEncodingType.None)
					}
				}
					break
				case SaveMethod.ToDataUrl: {
					setArrayEncodingType(ArrayEncodingType.ToString)
					const asString = JSON.stringify(game.serialize())
					setArrayEncodingType(ArrayEncodingType.None)

					const length = asString.length
					const bytes = new Uint8Array(length)
					for (let i = 0; i < length; i++)
						bytes[i] = asString.charCodeAt(i)!
					const url = URL.createObjectURL(new Blob([bytes]))
					args['saveResultsCallback']({'url': url})
				}
			}
		},
	}
}

