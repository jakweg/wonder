import { GameState } from '../3d-stuff/game-state/game-state'
import { StateUpdater } from '../3d-stuff/game-state/state-updater'
import { DEBUG, FORCE_ENV_ZERO, JS_ROOT } from '../build-info'
import { frontedVariablesBuffer } from '../util/frontend-variables'
import SettingsContainer from '../worker/observable-settings'
import { getCameraBuffer } from '../worker/serializable-settings'

export interface ConnectArguments {
	frontendVariables: SharedArrayBuffer
	camera: SharedArrayBuffer
	settings: SettingsContainer
	saveResultsCallback: ((data: { url: string }) => void)
}

export type Environment =
/** SharedArrayBuffer is not available.
 *  Do everything on the main thread*/
	'zero'
	/** SharedArrayBuffer is available, but OffscreenCanvas is not.
	 * Do event handling and rendering on the main thread and logic on background thread */
	| 'first'
	/** Both SharedArrayBuffer and OffscreenCanvas are available.
	 * Do event handling on the main thread, rendering on render-thread and logic on background thread */
	| 'second'

export interface StartRenderArguments {
	canvas: HTMLCanvasElement
	game: GameState
	updater: StateUpdater
}

export interface CreateGameArguments {
	saveName: string | undefined
}

export const enum SaveMethod {
	ToIndexedDatabase,
	ToDataUrl
}

export interface SaveGameArguments {
	saveName: string
	method: SaveMethod
}

export interface EnvironmentConnection {
	name: string

	createNewGame(args: CreateGameArguments): Promise<{ state: GameState, updater: StateUpdater }>

	startRender(args: StartRenderArguments): Promise<void>

	saveGame(args: SaveGameArguments): void
}

export const loadEnvironment = async (name: Environment,
                                      saveResultsCallback: ((data: { url: string }) => void))
	: Promise<Readonly<EnvironmentConnection>> => {
	if (FORCE_ENV_ZERO && name !== 'zero') {
		if (!DEBUG)
			console.error(`Forced environment change ${name} -> ${'zero' as Environment}`)
		name = 'zero'
	}
	const connect = (await import((`${JS_ROOT}/environments/${name}.js`)))['connect']
	const args: ConnectArguments = {
		'frontendVariables': frontedVariablesBuffer,
		'camera': getCameraBuffer(),
		'settings': SettingsContainer.INSTANCE,
		'saveResultsCallback': saveResultsCallback,
	}
	return Object.freeze(connect(args) as EnvironmentConnection)
}
