import { createGameStateForRenderer, GameState } from '../../game-state/game-state'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../../game-state/state-updater'
import { SaveGameArguments, SaveGameResult } from '../../game-state/world/world-saver'
import { TickQueueAction } from '../../network2/tick-queue-action'
import { frontedVariablesBuffer } from '../../util/frontend-variables'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { globalMutex, setGlobalMutex } from '../../util/worker/global-mutex'
import { spawnNew as spawnNewRenderWorker } from '../../util/worker/message-types/render'
import { spawnNew as spawnNewUpdateWorker } from '../../util/worker/message-types/update'
import {
	ConnectArguments, EnvironmentConnection,
	GameListeners,
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

	let entityContainerSnapshotForRenderer: any = null
	let gameSnapshotForRenderer: any = null
	let listeners: GameListeners | null = null
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null

	const [renderWorker, updateWorker] = await Promise.all([
		spawnNewRenderWorker(globalMutex),
		spawnNewUpdateWorker(globalMutex),
	])

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

	updateWorker.receive.on('tick-completed', data => {
		listeners?.onTickCompleted(data.tick)
	})

	renderWorker.receive.on('scheduled-action', action => {
		listeners?.onInputCaused(action)
	})

	updateWorker.receive.on('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
		entityContainerSnapshotForRenderer = data
		renderWorker.send.send('update-entity-container', data)
	})


	const terminate = (args: TerminateGameArguments) => {
		renderWorker.send.send('terminate-game', args)
		updateWorker.send.send('terminate-game', args)
		entityContainerSnapshotForRenderer = decodedGame = updater = listeners = null

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

			const data = await updateWorker.receive.await('game-create-result')

			gameSnapshotForRenderer = data
			decodedGame = createGameStateForRenderer(data.game)
			updater = createStateUpdaterControllerFromReceived(data.updater)

			return {
				state: decodedGame,
				updater,
				setActionsCallback(forTick: number, playerId: string, actions: TickQueueAction[]) {
					updateWorker.send.send('append-to-tick-queue', { forTick, playerId, actions })
				},
				setPlayerIdsCallback(ids) {
					updateWorker.send.send('set-player-ids', { playerIds: ids })
				},
				setGameListeners(l) {
					listeners = l
				},
			}
		},
		startRender: async function (renderArguments: StartRenderArguments): Promise<void> {
			if (gameSnapshotForRenderer === null)
				throw new Error('Create game first')

			const canvasControl = (renderArguments.canvas as any).transferControlToOffscreen()
			renderWorker.send.send('transfer-canvas', { canvas: canvasControl }, [canvasControl])
			renderWorker.send.send('game-create-result', gameSnapshotForRenderer)
			if (entityContainerSnapshotForRenderer !== null)
				renderWorker.send.send('update-entity-container', entityContainerSnapshotForRenderer)
		},
		async saveGame(args: SaveGameArguments): Promise<SaveGameResult> {
			if (updateWorker) {
				updateWorker.send.send('save-game', args)
				const result = await updateWorker.receive.await('game-saved')
				if (result !== false)
					return result
			}
			throw new Error('save failed')
		},
		terminate,
	}
}

