import { CreateGameArguments, TerminateGameArguments } from '@entry/feature-environments/loader'
import { SaveGameArguments, SaveGameResult } from '@game/world/world-saver'
import {
  bind as genericBind,
  spawnNew as genericSpawnNew,
  WorkerSpecification,
} from '@utils/new-worker/worker-instance'
import { TickQueueAction, UpdaterAction } from '../../../network/tick-queue-action'

const spec = {
  scriptName: 'update-worker',
  to: {
    setGameMutex: {} as { argument: any; result: void },
    setNewSettings: {} as { argument: any; result: void },
    createGame: {} as { argument: CreateGameArguments; result: { game: unknown; updater: unknown } },
    saveGame: {} as { argument: SaveGameArguments; result: SaveGameResult | false },
    terminateGame: {} as { argument: TerminateGameArguments; result: void },
    appendToTickQueue: {} as {
      argument: { actions: TickQueueAction[]; playerId: string; forTick: number }
      result: void
    },
    setPlayerIds: {} as { argument: { playerIds: string[] }; result: void },
  },
  from: {
    /** @deprecated entities container should be static */
    updateEntityContainer: {} as { argument: { buffers: SharedArrayBuffer[] }; result: void },
    markTickCompleted: {} as { argument: { tick: number; updaterActions: UpdaterAction[] }; result: void },
    updateDebugStatus: {} as { argument: any; result: void },
  },
} satisfies WorkerSpecification<any, any>

export const spawnNew = (l: Parameters<typeof genericSpawnNew<typeof spec>>[1]) => genericSpawnNew(spec, l)
export const bind = (l: Parameters<typeof genericBind<typeof spec>>[1]) => genericBind(spec, l)
