import { Camera } from '@3d/camera'
import { createRenderingSession } from '@3d/render-context'
import { GameStateImplementation } from '@game'
import { ActionsQueue, SendActionsQueue } from '@game/scheduled-actions/queue'
import { createNewStateUpdater, createStateUpdaterControllerFromReceived, StateUpdater } from '@game/state-updater'
import { loadGameFromArgs } from '@game/world/world-loader'
import { performGameSave, SaveGameArguments, SaveGameResult } from '@game/world/world-saver'
import { initFrontedVariablesFromReceived } from '@utils/frontend-variables-updaters'
import { createNewGameMutex } from '@utils/game-mutex'
import CONFIG from '@utils/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '@utils/persistance/serializable-settings'
import { observeField, reduce } from '@utils/state/subject'
import { FramesMeter } from '@utils/worker/debug-stats/frames-meter'
import { newStatsObject as newRenderStatsObject } from '@utils/worker/debug-stats/render'
import TimeMeter from '@utils/worker/debug-stats/time-meter'
import {
  newStatsObject as newUpdateStatsObject,
  StatField,
  UpdateDebugDataCollector,
} from '@utils/worker/debug-stats/update'
import { UpdatePhase } from '@utils/worker/debug-stats/update-phase'
import TickQueue from '../../network/tick-queue'
import { TickQueueAction } from '../../network/tick-queue-action'
import {
  ConnectArguments,
  CreateGameArguments,
  CreateGameResult,
  EnvironmentConnection,
  GameListeners,
  StartRenderArguments,
  TerminateGameArguments,
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const bind = (args: ConnectArguments): EnvironmentConnection => {
  initFrontedVariablesFromReceived(args.frontendVariables)
  setCameraBuffer(args.camera)
  args.settings.observeEverything(s => CONFIG.replace(s))

  let session: Awaited<ReturnType<typeof createRenderingSession>> | null = null
  let tickQueue: TickQueue | null = null
  let actionsQueue: ActionsQueue | null = null
  let game: GameStateImplementation | null = null
  let updater: StateUpdater | null = null
  let gameListeners: GameListeners | null = null

  const renderDebugStats = newRenderStatsObject()
  const stats = new UpdateDebugDataCollector(new FramesMeter(180), new TimeMeter(UpdatePhase.SIZE))
  const updateDebugStats = newUpdateStatsObject()
  stats.receiveUpdates(data => updateDebugStats.replaceFromArray(data))

  return {
    name: 'zero',
    async createNewGame(gameArgs: CreateGameArguments): Promise<CreateGameResult> {
      if (game !== null) this.terminate({})

      const mutex = createNewGameMutex()
      const stateBroadcastCallback = () => void 0 // ignore, since everything is locally anyway
      actionsQueue = SendActionsQueue.create(action => {
        gameListeners?.onInputCaused(action)
      })

      const pendingSession = createRenderingSession(actionsQueue, mutex)

      game = (await loadGameFromArgs(gameArgs, stats, mutex, stateBroadcastCallback)) as GameStateImplementation

      session = await pendingSession
      session.stats.updateTimesBuffer = updateDebugStats.get(StatField.UpdateTimes) as SharedArrayBuffer
      let timeoutId: ReturnType<typeof setTimeout>
      CONFIG.observe('debug/show-info', show => {
        if (show) {
          session!.stats.receiveUpdates(data => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => renderDebugStats.replaceFromArray(data), 0)
          })
        } else {
          session!.stats.stopUpdates()
        }
      })

      reduce(
        [observeField(CONFIG, 'debug/show-info'), observeField(CONFIG, 'debug/show-graphs')],
        (v, a) => a || v,
        false,
      ).on(v => stats.timeMeter.setEnabled(!!v))

      tickQueue = TickQueue.createEmpty()

      const updaterInstance = createNewStateUpdater(
        async gameActions => {
          await game!.advanceActivities(gameActions, stats)
          const currentTick = game!.currentTick
          gameListeners?.onTickCompleted(currentTick)
        },
        game.currentTick,
        tickQueue,
      )

      updater = createStateUpdaterControllerFromReceived(updaterInstance.pass())
      session.setGame(
        game,
        () => updater!.estimateCurrentGameTickTime(0),
        () => updater!.getTickRate(),
      )
      return {
        renderDebugStats,
        updateDebugStats,
        updater,
        setActionsCallback: (forTick: number, playerId: string, actions: TickQueueAction[]) => {
          tickQueue!.setForTick(forTick, playerId, actions)
        },
        setPlayerIdsCallback(ids) {
          tickQueue?.setRequiredPlayers(ids)
        },
        setGameListeners(l) {
          gameListeners = l
        },
      }
    },
    async startRender(args: StartRenderArguments): Promise<void> {
      if (game === null) throw new Error('Start game first')
      if (!session) return

      session!.setCamera(Camera.newUsingBuffer(getCameraBuffer()))
      session!.setCanvas(args.canvas)
    },
    terminate(_: TerminateGameArguments) {
      session?.cleanUp()
      updater?.stop()
      gameListeners = actionsQueue = game = updater = null
    },
    async saveGame(saveArgs: SaveGameArguments): Promise<SaveGameResult> {
      const result = game ? await performGameSave(game, saveArgs) : false
      if (result === false) throw new Error()
      return result
    },
  }
}
