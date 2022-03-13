import { GameState } from '../3d-stuff/game-state/game-state'
import { StateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { frontedVariablesBuffer } from '../util/frontend-variables'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { setMessageHandler } from '../worker/message-handler'
import SettingsContainer from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { WorkerController } from '../worker/worker-controller'
import { globalMutex } from '../worker/worker-global-state'
import { ConnectArguments, EnvironmentConnection, StartRenderArguments } from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = (args: ConnectArguments): EnvironmentConnection => {
	initFrontedVariablesFromReceived(args.frontendVariables)
	setCameraBuffer(args.camera)
	SettingsContainer.INSTANCE = args.settings

	let gameSnapshotForRenderer: any = null
	let entityContainerSnapshotForRenderer: any = null
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	let updateWorker: WorkerController | null = null
	let renderWorker: WorkerController | null = null

	return {
		name: 'zero',
		async createNewGame() {
			if (updateWorker !== null)
				throw new Error('Game was already created')

			updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
			updateWorker.replier.send('create-game', undefined)
			args.settings.observeEverything(snapshot => updateWorker?.replier.send('new-settings', snapshot))

			setMessageHandler('update-entity-container', data => {
				decodedGame!.entities.replaceBuffersFromReceived(data)
				entityContainerSnapshotForRenderer = data
				renderWorker?.replier.send('update-entity-container', data)
			})

			return await new Promise(resolve => {
				setMessageHandler('game-snapshot-for-renderer', (data) => {
					gameSnapshotForRenderer = data

					decodedGame = GameState.forRenderer(data.game)
					updater = stateUpdaterFromReceived(globalMutex, data.updater)

					resolve({state: decodedGame, updater})
				})
			})
		},
		async startRender(renderArguments: StartRenderArguments): Promise<void> {
			if (renderWorker !== null)
				throw new Error('Render worker was already created')

			if (gameSnapshotForRenderer === null)
				throw new Error('Create game first')

			renderWorker = await WorkerController.spawnNew('render-worker', 'render', globalMutex)
			args.settings.observeEverything(snapshot => renderWorker?.replier.send('new-settings', snapshot))
			const canvasControl = (renderArguments.canvas as any).transferControlToOffscreen()
			renderWorker.replier.send('frontend-variables', {buffer: frontedVariablesBuffer})
			renderWorker.replier.send('camera-buffer', {buffer: getCameraBuffer()})
			renderWorker.replier.send('transfer-canvas', {canvas: canvasControl}, [canvasControl])
			renderWorker.replier.send('game-snapshot-for-renderer', gameSnapshotForRenderer)
			renderWorker.replier.send('set-worker-load-delays', {
				render: renderWorker.workerStartDelay,
				update: updateWorker!.workerStartDelay,
			})
			if (entityContainerSnapshotForRenderer !== null)
				renderWorker.replier.send('update-entity-container', entityContainerSnapshotForRenderer)
		},
	}
}

