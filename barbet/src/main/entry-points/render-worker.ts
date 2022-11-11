import { Camera } from '@3d/camera'
import { createRenderingSession } from '@3d/render-context'
import { createGameStateForRenderer, GameState } from '@game'
import { SendActionsQueue } from '@game/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived } from '@game/state-updater'
import { initFrontedVariablesFromReceived } from '@utils/frontend-variables-updaters'
import { gameMutexFrom } from '@utils/game-mutex'
import CONFIG from '@utils/persistance/observable-settings'
import { bind, FromWorker, ToWorker } from '@utils/worker/message-types/render'
;(async () => {
  const { sender, receiver } = await bind()
  const mutex = gameMutexFrom(await receiver.await(ToWorker.GameMutex))
  const actionsQueue = SendActionsQueue.create(action => sender.send(FromWorker.ScheduledAction, action))
  receiver.suspend()
  const session = await createRenderingSession(actionsQueue, mutex)
  receiver.resume()

  let workerStartDelayDifference = 0
  let gameSnapshot: unknown | null = null
  let decodedGame: GameState | null = null

  receiver.on(ToWorker.NewSettings, settings => {
    CONFIG.update(settings)
  })

  receiver.on(ToWorker.TransferCanvas, data => {
    const canvas = data.canvas as HTMLCanvasElement
    session.setCanvas(canvas)
  })

  receiver.on(ToWorker.SetWorkerLoadDelays, data => {
    workerStartDelayDifference = data.update - data.render
  })

  receiver.on(ToWorker.GameCreateResult, data => {
    gameSnapshot = data.game
    const snapshot = data as any
    const game = (decodedGame = createGameStateForRenderer(snapshot.game))
    const decodedUpdater = createStateUpdaterControllerFromReceived(snapshot.updater)
    const gameTickEstimation = () => decodedUpdater!.estimateCurrentGameTickTime(workerStartDelayDifference)
    session.setGame(game, gameTickEstimation, () => decodedUpdater.getTickRate())
  })

  receiver.on(ToWorker.UpdateEntityContainer, data => {
    decodedGame!.entities.replaceBuffersFromReceived(data)
  })

  receiver.on(ToWorker.CameraBuffer, data => {
    session.setCamera(Camera.newUsingBuffer(data.buffer))
  })

  receiver.on(ToWorker.FrontendVariables, data => {
    initFrontedVariablesFromReceived(data.buffer)
  })

  receiver.on(ToWorker.TerminateGame, args => {
    session.cleanUp()
    if (args.terminateEverything) close()
  })

  receiver.on(ToWorker.UpdateTimesBuffer, ({ buffer }) => {
    session.stats.updateTimesBuffer = buffer
  })

  let timeoutId: ReturnType<typeof setTimeout>
  CONFIG.observe('debug/show-info', show => {
    if (show) {
      session.stats.receiveUpdates(data => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => void sender.send(FromWorker.DebugStatsUpdate, data), 0)
      })
    } else session.stats.stopUpdates()
  })
})()
