import { createStateUpdaterControllerFromReceived, StateUpdater } from '@game/state-updater'
import { SaveGameArguments, SaveGameResult } from '@game/world/world-saver'
import { createNewGameMutex } from '@utils/game-mutex'
import { spawnNew as spawnNewRenderWorker } from '@utils/new-worker/specs/render'
import { spawnNew as spawnNewUpdateWorker } from '@utils/new-worker/specs/update'
import CONFIG from '@utils/persistence/observable-settings'
import { setCameraBuffer } from '@utils/persistence/serializable-settings'
import { newStatsObject as newRenderStatsObject } from '@utils/worker/debug-stats/render'
import { newStatsObject as newUpdateStatsObject, StatField } from '@utils/worker/debug-stats/update'
import { UICanvas } from 'src/main/ui/canvas-background'
import { TickQueueAction } from '../../network/tick-queue-action'
import { ConnectArguments, EnvironmentConnection, GameListeners, TerminateGameArguments } from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const bind = async (args: ConnectArguments): Promise<EnvironmentConnection> => {
  setCameraBuffer(args.camera)
  args.settings.observeEverything(s => CONFIG.replace(s))

  let entityContainerSnapshotForRenderer: any = null
  let listeners: GameListeners | null = null
  let updater: StateUpdater | null = null

  const mutex = createNewGameMutex()
  const renderDebugStats = newRenderStatsObject()
  const updateDebugStats = newUpdateStatsObject()

  let renderWorker: Awaited<ReturnType<typeof spawnNewRenderWorker>>
  let updateWorker: Awaited<ReturnType<typeof spawnNewUpdateWorker>>

  let firstTimeUpdateDebugStatus = true

  const workers = await Promise['all']([
    spawnNewRenderWorker({
      scheduleAction: action => listeners?.onInputCaused(action),
      updateDebugStats: data => renderDebugStats.replaceFromArray(data),
    }),
    spawnNewUpdateWorker({
      markTickCompleted(data) {
        listeners?.onTickCompleted(data.tick)
      },
      updateEntityContainer(data) {
        entityContainerSnapshotForRenderer = data
        renderWorker.functions.updateEntityContainer(data)
      },
      updateDebugStatus(data) {
        if (firstTimeUpdateDebugStatus) updateDebugStats.replaceFromArray(data)
        firstTimeUpdateDebugStatus = false
        renderWorker.functions.setUpdateTimesBuffer({
          buffer: updateDebugStats.get(StatField.UpdateTimes) as any as SharedArrayBuffer,
        })
      },
    }),
  ])
  renderWorker = workers[0]
  updateWorker = workers[1]

  renderWorker.functions.setGameMutex(mutex.pass())
  updateWorker.functions.setGameMutex(mutex.pass())

  CONFIG.observeEverything(snapshot => {
    updateWorker.functions.setNewSettings(snapshot)
    renderWorker.functions.setNewSettings(snapshot)
  })

  const terminate = (args: TerminateGameArguments) => {
    renderWorker.functions.terminateGame(args)
    updateWorker.functions.terminateGame(args)
    entityContainerSnapshotForRenderer = updater = listeners = null

    if (args.terminateEverything) {
      setTimeout(() => updateWorker.terminate(), 10_000)
      setTimeout(() => renderWorker.terminate(), 10_000)
    }
  }

  return {
    name: 'second',
    async createNewGame(gameArgs, renderArgs) {
      if (updater !== null) terminate({})

      const data = await updateWorker.functions.createGame(gameArgs)

      updater = createStateUpdaterControllerFromReceived(data.updater)

      const canvas = {
        ...renderArgs.canvas,
        element: renderArgs.canvas.element.transferControlToOffscreen() as any as HTMLCanvasElement,
      } satisfies UICanvas
      renderWorker.functions.startRenderingSession(
        {
          cameraBuffer: args.camera,
          passedMutex: mutex.pass(),
          canvas: canvas,
          passedGame: data.game,
          updater: data.updater,
          workerStartDelayDifference: updateWorker.startupTimeDifference - renderWorker.startupTimeDifference,
        },
        [canvas.element],
      )

      return {
        renderDebugStats,
        updateDebugStats,
        updater,
        setActionsCallback(forTick: number, playerId: string, actions: TickQueueAction[]) {
          updateWorker.functions.appendToTickQueue({ forTick, playerId, actions })
        },
        setPlayerIdsCallback(ids) {
          updateWorker.functions.setPlayerIds({ playerIds: ids })
        },
        setGameListeners(l) {
          listeners = l
        },
      }
    },
    async saveGame(args: SaveGameArguments): Promise<SaveGameResult<any>> {
      if (updateWorker) {
        const result = await updateWorker.functions.saveGame(args)
        if (result !== false) return result
      }
      throw new Error('save failed')
    },
    terminate,
  }
}
