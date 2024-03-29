import { createStateUpdaterControllerFromReceived, StateUpdater } from '@game/state-updater'
import { SaveGameArguments, SaveGameResult } from '@game/world/world-saver'
import { frontedVariablesBuffer } from '@utils/frontend-variables'
import { initFrontedVariablesFromReceived } from '@utils/frontend-variables-updaters'
import { createNewGameMutex } from '@utils/game-mutex'
import CONFIG from '@utils/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '@utils/persistance/serializable-settings'
import { newStatsObject as newRenderStatsObject } from '@utils/worker/debug-stats/render'
import { newStatsObject as newUpdateStatsObject, StatField } from '@utils/worker/debug-stats/update'
import {
  FromWorker as FromRender,
  spawnNew as spawnNewRenderWorker,
  ToWorker as ToRender,
} from '@utils/worker/message-types/render'
import {
  FromWorker as FromUpdate,
  spawnNew as spawnNewUpdateWorker,
  ToWorker as ToUpdate,
} from '@utils/worker/message-types/update'
import { TickQueueAction } from '../../network/tick-queue-action'
import {
  ConnectArguments,
  EnvironmentConnection,
  GameListeners,
  StartRenderArguments,
  TerminateGameArguments,
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const bind = async (args: ConnectArguments): Promise<EnvironmentConnection> => {
  initFrontedVariablesFromReceived(args.frontendVariables)
  setCameraBuffer(args.camera)
  args.settings.observeEverything(s => CONFIG.replace(s))

  let entityContainerSnapshotForRenderer: any = null
  let gameSnapshotForRenderer: any = null
  let listeners: GameListeners | null = null
  let updater: StateUpdater | null = null

  const mutex = createNewGameMutex()

  const [renderWorker, updateWorker] = await Promise['all']([spawnNewRenderWorker(), spawnNewUpdateWorker()])

  renderWorker.send.send(ToRender.GameMutex, mutex.pass())
  updateWorker.send.send(ToUpdate.GameMutex, mutex.pass())

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

  const renderDebugStats = newRenderStatsObject()
  const updateDebugStats = newUpdateStatsObject()
  renderWorker.receive.on(FromRender.DebugStatsUpdate, data => renderDebugStats.replaceFromArray(data))
  updateWorker.receive.once(FromUpdate.DebugStatsUpdate, data => {
    updateDebugStats.replaceFromArray(data)
    renderWorker.send.send(ToRender.UpdateTimesBuffer, {
      buffer: updateDebugStats.get(StatField.UpdateTimes) as SharedArrayBuffer,
    })
  })
  updateWorker.receive.on(FromUpdate.DebugStatsUpdate, data => updateDebugStats.replaceFromArray(data))

  return {
    name: 'second',
    async createNewGame(gameArgs) {
      if (updater !== null) terminate({})

      updateWorker.send.send(ToUpdate.CreateGame, gameArgs)

      const data = await updateWorker.receive.await(FromUpdate.GameCreateResult)

      gameSnapshotForRenderer = data
      updater = createStateUpdaterControllerFromReceived(data.updater)

      renderWorker.send.send(ToRender.GameCreateResult, gameSnapshotForRenderer)
      return {
        renderDebugStats,
        updateDebugStats,
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
      if (gameSnapshotForRenderer === null) throw new Error('Create game first')

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
        if (result !== false) return result
      }
      throw new Error('save failed')
    },
    terminate,
  }
}
