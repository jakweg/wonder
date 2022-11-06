import { GameStateImplementation } from '../game-state/game-state'
import { createNewStateUpdater } from '../game-state/state-updater'
import { StateUpdaterImplementation } from '../game-state/state-updater/implementation'
import { loadGameFromArgs } from '../game-state/world/world-loader'
import { performGameSave } from '../game-state/world/world-saver'
import TickQueue from '../network/tick-queue'
import { gameMutexFrom } from '../util/game-mutex'
import CONFIG from '../util/persistance/observable-settings'
import { observeField, reduce } from '../util/state/subject'
import { FramesMeter } from '../util/worker/debug-stats/frames-meter'
import { FRAMES_COUNT_UPDATE } from '../util/worker/debug-stats/graph-renderer'
import TimeMeter from '../util/worker/debug-stats/time-meter'
import { UpdateDebugDataCollector } from '../util/worker/debug-stats/update'
import { UpdatePhase } from '../util/worker/debug-stats/update-phase'
import { bind, FromWorker, ToWorker } from '../util/worker/message-types/update'

const { sender, receiver } = await bind()
const mutex = gameMutexFrom(await receiver.await(ToWorker.GameMutex))

const stats = new UpdateDebugDataCollector(new FramesMeter(FRAMES_COUNT_UPDATE), new TimeMeter(UpdatePhase.SIZE))
let gameState: GameStateImplementation | null = null
let stateUpdater: StateUpdaterImplementation | null = null
let tickQueue: TickQueue | null = null

receiver.on(ToWorker.NewSettings, settings => {
  CONFIG.update(settings)
})

receiver.on(ToWorker.TerminateGame, args => {
  stateUpdater?.terminate()
  gameState = stateUpdater = null
  if (args.terminateEverything) close()
})

receiver.on(ToWorker.CreateGame, async args => {
  const stateBroadcastCallback = () => {
    if (gameState === null) return
    sender.send(FromWorker.UpdateEntityContainer, {
      buffers: gameState?.entities?.passBuffers(),
    })
  }

  gameState = (await loadGameFromArgs(args, stats, mutex, stateBroadcastCallback)) as GameStateImplementation

  tickQueue = TickQueue.createEmpty()

  stateUpdater = createNewStateUpdater(
    async (gameActions, updaterActions) => {
      await gameState!.advanceActivities(gameActions, stats)

      const currentTick = gameState!.currentTick

      sender.send(FromWorker.TickCompleted, { tick: currentTick, updaterActions })
    },
    gameState.currentTick,
    tickQueue,
  )

  sender.send(FromWorker.GameCreateResult, {
    game: gameState!.passForRenderer(),
    updater: stateUpdater!.pass(),
  })
})

receiver.on(ToWorker.SaveGame, async data => {
  const result = gameState ? await performGameSave(gameState, data) : false
  sender.send(FromWorker.GameSaved, result)
})

receiver.on(ToWorker.AppendToTickQueue, ({ actions, playerId, forTick }) => {
  tickQueue?.setForTick(forTick, playerId, actions)
})

receiver.on(ToWorker.SetPlayerIds, ({ playerIds }) => {
  tickQueue?.setRequiredPlayers(playerIds)
})

let timeoutId: ReturnType<typeof setTimeout>
const previous = CONFIG.get('debug/show-info')
CONFIG.set('debug/show-info', true)
CONFIG.observe('debug/show-info', show => {
  if (show) {
    stats.receiveUpdates(data => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => void sender.send(FromWorker.DebugStatsUpdate, data), 0)
    })
  } else stats.stopUpdates()
})
CONFIG.set('debug/show-info', previous)

reduce(
  [observeField(CONFIG, 'debug/show-info'), observeField(CONFIG, 'debug/show-graphs')],
  (v, a) => a || v,
  false,
).on(v => stats.timeMeter.setEnabled(!!v))
