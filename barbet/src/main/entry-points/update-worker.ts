import { GameStateImplementation } from '@game'
import { createNewStateUpdater } from '@game/state-updater'
import { StateUpdaterImplementation } from '@game/state-updater/implementation'
import { loadGameFromArgs } from '@game/world/world-loader'
import { performGameSave } from '@game/world/world-saver'
import { GameMutex, gameMutexFrom } from '@utils/game-mutex'
import { bind } from '@utils/new-worker/specs/update'
import CONFIG from '@utils/persistence/observable-settings'
import { observeField, reduce } from '@utils/state/subject'
import { FramesMeter } from '@utils/worker/debug-stats/frames-meter'
import TimeMeter from '@utils/worker/debug-stats/time-meter'
import { UpdateDebugDataCollector } from '@utils/worker/debug-stats/update'
import { UpdatePhase } from '@utils/worker/debug-stats/update-phase'
import TickQueue from '../network/tick-queue'

const FRAMES_COUNT_UPDATE = 180

const stats = new UpdateDebugDataCollector(new FramesMeter(FRAMES_COUNT_UPDATE), new TimeMeter(UpdatePhase.SIZE))
let mutex: GameMutex | null = null
let gameState: GameStateImplementation | null = null
let stateUpdater: StateUpdaterImplementation | null = null
let tickQueue: TickQueue | null = null

const functions = bind({
  setNewSettings: settings => CONFIG.update(settings),
  terminateGame(args) {
    stateUpdater?.terminate()
    gameState = stateUpdater = null
    if (args.terminateEverything) close()
  },
  async createGame(args) {
    gameState = (await loadGameFromArgs(args, stats, mutex!)) as GameStateImplementation

    tickQueue = TickQueue.createEmpty()

    stateUpdater = createNewStateUpdater(
      async (gameActions, updaterActions) => {
        await gameState!.advanceActivities(gameActions, stats)

        const currentTick = gameState!.currentTick

        functions.markTickCompleted({ tick: currentTick, updaterActions })
      },
      gameState.currentTick,
      tickQueue,
    )

    return {
      game: gameState!.passForRenderer(),
      updater: stateUpdater!.pass(),
    }
  },
  async saveGame(args) {
    const result = gameState ? await performGameSave(gameState, args) : false
    return result
  },
  appendToTickQueue({ actions, playerId, forTick }) {
    tickQueue?.setForTick(forTick, playerId, actions)
  },
  setPlayerIds({ playerIds }) {
    tickQueue?.setRequiredPlayers(playerIds)
  },
  setGameMutex(arg) {
    mutex = gameMutexFrom(arg)
  },
})

let timeoutId: ReturnType<typeof setTimeout>
const previous = CONFIG.get('debug/show-info')
CONFIG.set('debug/show-info', true)
CONFIG.observe('debug/show-info', show => {
  if (show) {
    stats.receiveUpdates(data => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => void functions.updateDebugStatus(data), 0)
    })
  } else stats.stopUpdates()
})
CONFIG.set('debug/show-info', previous)

reduce(
  [observeField(CONFIG, 'debug/show-info'), observeField(CONFIG, 'debug/show-graphs')],
  (v, a) => a || v,
  false,
).on(v => stats.timeMeter.setEnabled(!!v))
