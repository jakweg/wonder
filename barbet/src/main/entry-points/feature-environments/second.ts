import { createGameStateForRenderer, GameState } from '../../game-state/game-state'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../../game-state/state-updater'
import { TickQueueAction } from '../../network/tick-queue-action'
import { frontedVariablesBuffer } from '../../util/frontend-variables'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { globalMutex, setGlobalMutex } from '../../util/worker/global-mutex'
import { spawnNew as spawnNewRenderWorker } from '../../util/worker/message-types/render'
import { spawnNew as spawnNewUpdateWorker } from '../../util/worker/message-types/update'
import {
	ConnectArguments,
	CreateGameResult,
	EnvironmentConnection,
	SaveGameArguments,
	StartRenderArguments,
	TerminateGameArguments
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

	const renderWorker = await spawnNewRenderWorker(globalMutex)
	const updateWorker = await spawnNewUpdateWorker(globalMutex)
	CONFIG.observeEverything(snapshot => {
		updateWorker.send.send('new-settings', snapshot)
		renderWorker.send.send('new-settings', snapshot)
	})

	renderWorker.send.send('frontend-variables', { buffer: frontedVariablesBuffer })
	renderWorker.send.send('camera-buffer', { buffer: getCameraBuffer() })
	renderWorker.send.send('set-worker-load-delays', {
		render: renderWorker.startDelay,
		update: updateWorker.startDelay,
	})

	updateWorker.receive.on('feedback', data => {
		args.feedbackCallback(data)
	})
	renderWorker.receive.on('feedback', data => args.feedbackCallback(data))

	updateWorker.receive.on('scheduled-action', action => {
		args.feedbackCallback({ type: 'input-action', value: action })
	})
	renderWorker.receive.on('scheduled-action', action => {
		args.feedbackCallback({ type: 'input-action', value: action })
	})

	const setActionsCallback = (forTick: number, playerId: number, actions: TickQueueAction[]) => {
		updateWorker.send.send('append-to-tick-queue', { forTick, playerId, actions })
	}

	updateWorker.receive.on('game-snapshot-for-renderer', (data) => {
		gameSnapshotForRenderer = data
		decodedGame = createGameStateForRenderer(data.game)
		updater = createStateUpdaterControllerFromReceived(data.updater)
		startGameCallback?.({ state: decodedGame, updater, setActionsCallback })
	})
	updateWorker.receive.on('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
		entityContainerSnapshotForRenderer = data
		renderWorker.send.send('update-entity-container', data)
	})


	const terminate = (args: TerminateGameArguments) => {
		renderWorker.send.send('terminate-game', args)
		updateWorker.send.send('terminate-game', args)
		entityContainerSnapshotForRenderer = decodedGame = updater = null

		if (args.terminateEverything) {
			setTimeout(() => updateWorker.terminate(), 10_000)
			setTimeout(() => renderWorker.terminate(), 10_000)
		}
	}

	return {
		name: 'second',
		async createNewGame(gameArgs) {
			if (decodedGame !== null)
				terminate({})

			updateWorker.send.send('create-game', gameArgs)

			return new Promise(resolve => startGameCallback = resolve)
		},
		startRender: async function (renderArguments: StartRenderArguments): Promise<void> {
			if (gameSnapshotForRenderer === null)
				throw new Error('Create game first')

			const canvasControl = (renderArguments.canvas as any).transferControlToOffscreen()
			renderWorker.send.send('transfer-canvas', { canvas: canvasControl }, [canvasControl])
			renderWorker.send.send('game-snapshot-for-renderer', gameSnapshotForRenderer)
			if (entityContainerSnapshotForRenderer !== null)
				renderWorker.send.send('update-entity-container', entityContainerSnapshotForRenderer)
		},
		saveGame(args: SaveGameArguments): void {
			updateWorker?.send?.send('save-game', args)
		},
		terminate,
	}
}

