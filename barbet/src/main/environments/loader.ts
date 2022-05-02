import { DEBUG, FORCE_ENV_ZERO, JS_ROOT } from '../build-info'
import { GameState } from '../game-state/game-state'
import { ScheduledAction } from '../game-state/scheduled-actions'
import { StateUpdater } from '../game-state/state-updater'
import { TickQueueAction, UpdaterAction } from '../network/tick-queue-action'
import { frontedVariablesBuffer } from '../util/frontend-variables'
import Mutex from '../util/mutex'
import { sharedMemoryIsAvailable } from '../util/shared-memory'
import { globalMutex } from '../worker/global-mutex'
import CONFIG from '../util/persistance/observable-settings'
import { getCameraBuffer } from '../util/persistance/serializable-settings'

export type FeedbackEvent =
	{ type: 'saved-to-url', url: string }
	| { type: 'tick-completed', tick: number, updaterActions: UpdaterAction[] }
	| { type: 'saved-to-string', serializedState: string, name: string, inputActorIds: number[] }
	| { type: 'input-action', value: ScheduledAction }

export interface ConnectArguments {
	mutex: Mutex
	frontendVariables: SharedArrayBuffer
	camera: SharedArrayBuffer
	settings: typeof CONFIG
	feedbackCallback: ((event: FeedbackEvent) => void)
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
}

export interface CreateGameArguments {
	saveName?: string
	fileToRead?: File
	stringToRead?: string
	existingInputActorIds?: number[]
}

export const enum SaveMethod {
	ToIndexedDatabase,
	ToDataUrl,
	ToString,
}

export interface SaveGameArguments {
	saveName: string
	method: SaveMethod
}

export interface TerminateGameArguments {
}

export type SetActionsCallback = (forTick: number, playerId: number, actions: TickQueueAction[]) => void

export interface CreateGameResult {
	state: GameState,
	updater: StateUpdater,
	setActionsCallback: SetActionsCallback
}

export interface EnvironmentConnection {
	name: string

	createNewGame(args: CreateGameArguments): Promise<CreateGameResult>

	startRender(args: StartRenderArguments): Promise<void>

	saveGame(args: SaveGameArguments): void

	terminateGame(args: TerminateGameArguments): void
}

export const getSuggestedEnvironmentName = (preferredEnvironment: Environment) => {
	let usedEnvironment: Environment = 'zero'
	if (sharedMemoryIsAvailable && preferredEnvironment !== 'zero') {
		const offscreenCanvasIsAvailable = !!((window as any).OffscreenCanvas)
		if (offscreenCanvasIsAvailable && preferredEnvironment !== 'first')
			usedEnvironment = 'second'
		else {
			usedEnvironment = 'first'
		}
	}
	return usedEnvironment
}

export const loadEnvironment = async (name: Environment,
                                      feedbackCallback: (event: FeedbackEvent) => void)
	: Promise<Readonly<EnvironmentConnection>> => {
	if (FORCE_ENV_ZERO && name !== 'zero') {
		if (!DEBUG)
			console.error(`Forced environment change ${name} -> ${'zero' as Environment}`)
		name = 'zero'
	}
	const connect = (await import((`${JS_ROOT}/environments/${name}.js`)))['bind']
	const args: ConnectArguments = {
		mutex: globalMutex,
		frontendVariables: frontedVariablesBuffer,
		camera: getCameraBuffer(),
		settings: CONFIG,
		feedbackCallback,
	}
	return Object.freeze(await connect(args) as EnvironmentConnection)
}
