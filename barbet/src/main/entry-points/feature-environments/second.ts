import { createStateUpdaterControllerFromReceived, StateUpdater } from '../../game-state/state-updater'
import { SaveGameArguments, SaveGameResult } from '../../game-state/world/world-saver'
import { TickQueueAction } from '../../network/tick-queue-action'
import { frontedVariablesBuffer } from '../../util/frontend-variables'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { globalMutex, setGlobalMutex } from '../../util/worker/global-mutex'
import { FromWorker as FromRender, spawnNew as spawnNewRenderWorker, ToWorker as ToRender } from '../../util/worker/message-types/render'
import { FromWorker as FromUpdate, spawnNew as spawnNewUpdateWorker, ToWorker as ToUpdate } from '../../util/worker/message-types/update'
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
	let updater: StateUpdater | null = null

	const [renderWorker, updateWorker] = await Promise['all']([
		spawnNewRenderWorker(globalMutex),
		spawnNewUpdateWorker(globalMutex),
	])

	CONFIG.observeEverything(snapshot => {
		updateWorker.send.send(ToUpdate.NewSettings, snapshot)
		renderWorker.send.send(ToRender.NewSettings, snapshot)
	})

	renderWorker.send.send(ToRender.FrontendVariables, { buffer: frontedVariablesBuffer })
	renderWorker.send.send(ToRender.CameraBuffer, { buffer: getCameraBuffer() })
	renderWorker.send.send(ToRender.SetWorkerLoadDelays, {
		render: renderWorker.startDelay,
		update: updateWorker.startDelay,
	})

	updateWorker.receive.on(FromUpdate.TickCompleted, data => {
		listeners?.onTickCompleted(data.tick)
	})

	renderWorker.receive.on(FromRender.ScheduledAction, action => {
		listeners?.onInputCaused(action)
	})

	updateWorker.receive.on(FromUpdate.UpdateEntityContainer, data => {
		entityContainerSnapshotForRenderer = data
		renderWorker.send.send(ToRender.UpdateEntityContainer, data)
	})


	const terminate = (args: TerminateGameArguments) => {
		renderWorker.send.send(ToRender.TerminateGame, args)
		updateWorker.send.send(ToUpdate.TerminateGame, args)
		entityContainerSnapshotForRenderer = updater = listeners = null

		if (args.terminateEverything) {
			setTimeout(() => updateWorker.terminate(), 10_000)
			setTimeout(() => renderWorker.terminate(), 10_000)
		}
	}

	return {
		name: 'second',
		async createNewGame(gameArgs) {
			if (updater !== null)
				terminate({})

			updateWorker.send.send(ToUpdate.CreateGame, gameArgs)

			const data = await updateWorker.receive.await(FromUpdate.GameCreateResult)

			gameSnapshotForRenderer = data
			updater = createStateUpdaterControllerFromReceived(data.updater)

			renderWorker.send.send(ToRender.GameCreateResult, gameSnapshotForRenderer)
			return {
				updater,
				setActionsCallback(forTick: number, playerId: string, actions: TickQueueAction[]) {
					updateWorker.send.send(ToUpdate.AppendToTickQueue, { forTick, playerId, actions })
				},
				setPlayerIdsCallback(ids) {
					updateWorker.send.send(ToUpdate.SetPlayerIds, { playerIds: ids })
				},
				setGameListeners(l) {
					listeners = l
				},
			}
		},
		startRender: async function (renderArguments: StartRenderArguments) {
			if (gameSnapshotForRenderer === null)
				throw new Error('Create game first')

			const canvasControl = (renderArguments.canvas as any).transferControlToOffscreen()
			renderWorker.send.send(ToRender.TransferCanvas, { canvas: canvasControl }, [canvasControl])
			// renderWorker.send.send(ToRender.GameCreateResult, gameSnapshotForRenderer)
			if (entityContainerSnapshotForRenderer !== null)
				renderWorker.send.send(ToRender.UpdateEntityContainer, entityContainerSnapshotForRenderer)
		},
		async saveGame(args: SaveGameArguments): Promise<SaveGameResult> {
			if (updateWorker) {
				updateWorker.send.send(ToUpdate.SaveGame, args)
				const result = await updateWorker.receive.await(FromUpdate.GameSaved)
				if (result !== false)
					return result
			}
			throw new Error('save failed')
		},
		terminate,
	}
}

