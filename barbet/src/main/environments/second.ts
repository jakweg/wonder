import { createGameStateForRenderer, GameState } from '../game-state/game-state'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../game-state/state-updater'
import { TickQueueAction } from '../network/tick-queue-action'
import { frontedVariablesBuffer } from '../util/frontend-variables'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { globalMutex, setGlobalMutex } from '../worker/global-mutex'
import { setMessageHandler } from '../worker/message-handler'
import CONFIG from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { WorkerController } from '../worker/worker-controller'
import {
	ConnectArguments,
	CreateGameResult,
	EnvironmentConnection,
	SaveGameArguments,
	StartRenderArguments,
	TerminateGameArguments,
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const bind = async (args: ConnectArguments): Promise<EnvironmentConnection> => {
	setGlobalMutex(args.mutex.pass())
	initFrontedVariablesFromReceived(args.frontendVariables)
	setCameraBuffer(args.camera)
	args.settings.observeEverything(s => CONFIG.replace(s))

	let startGameCallback: ((results: CreateGameResult) => void) | null = null
	let entityContainerSnapshotForRenderer: any = null
	let gameSnapshotForRenderer: any = null
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null

	const updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
	const renderWorker = await WorkerController.spawnNew('render-worker', 'render', globalMutex)
	CONFIG.observeEverything(snapshot => {
		updateWorker.replier.send('new-settings', snapshot)
		renderWorker.replier.send('new-settings', snapshot)
	})

	renderWorker.replier.send('frontend-variables', {buffer: frontedVariablesBuffer})
	renderWorker.replier.send('camera-buffer', {buffer: getCameraBuffer()})
	renderWorker.replier.send('set-worker-load-delays', {
		render: renderWorker.workerStartDelay,
		update: updateWorker!.workerStartDelay,
	})

	setMessageHandler('feedback', data => {
		args.feedbackCallback(data)
	})

	setMessageHandler('scheduled-action', action => {
		args.feedbackCallback({type: 'input-action', value: action})
	})

	const setActionsCallback = (tick: number, actions: TickQueueAction[]) => {
		updateWorker.replier.send('append-to-tick-queue', {
			forTick: tick,
			actions,
		})
	}

	setMessageHandler('game-snapshot-for-renderer', (data) => {
		gameSnapshotForRenderer = data
		decodedGame = createGameStateForRenderer(data.game)
		updater = createStateUpdaterControllerFromReceived(data.updater)
		startGameCallback?.({state: decodedGame, updater, setActionsCallback})
	})
	setMessageHandler('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
		entityContainerSnapshotForRenderer = data
		renderWorker.replier.send('update-entity-container', data)
	})


	return {
		name: 'second',
		async createNewGame(gameArgs) {
			if (decodedGame !== null)
				throw new Error('Game was already created')

			updateWorker.replier.send('create-game', gameArgs)

			return new Promise(resolve => startGameCallback = resolve)
		},
		startRender: async function (renderArguments: StartRenderArguments): Promise<void> {
			if (gameSnapshotForRenderer === null)
				throw new Error('Create game first')

			const canvasControl = (renderArguments.canvas as any).transferControlToOffscreen()
			renderWorker.replier.send('transfer-canvas', {canvas: canvasControl}, [canvasControl])
			renderWorker.replier.send('game-snapshot-for-renderer', gameSnapshotForRenderer)
			if (entityContainerSnapshotForRenderer !== null)
				renderWorker.replier.send('update-entity-container', entityContainerSnapshotForRenderer)
		},
		saveGame(args: SaveGameArguments): void {
			updateWorker.replier?.send('save-game', args)
		},
		terminateGame(args: TerminateGameArguments): void {
			renderWorker.replier.send('terminate-game', args)
			updateWorker.replier.send('terminate-game', args)
			entityContainerSnapshotForRenderer = decodedGame = updater = null
		},
	}
}

