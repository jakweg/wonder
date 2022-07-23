import { CreateGameArguments, TerminateGameArguments } from "../../../entry-points/feature-environments/loader";
import { SaveGameArguments, SaveGameResult } from "../../../game-state/world/world-saver";
import { TickQueueAction, UpdaterAction } from "../../../network2/tick-queue-action";
import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    'new-settings': any
    'create-game': CreateGameArguments
    'save-game': SaveGameArguments
    'terminate-game': TerminateGameArguments
    'append-to-tick-queue': { actions: TickQueueAction[], playerId: string, forTick: number }
    'set-player-ids': { playerIds: string[] }
}

interface FromWorker {
    'game-create-result': { game: unknown, updater: unknown }
    'update-entity-container': { buffers: SharedArrayBuffer[] }
    'game-saved': SaveGameResult | false
    'tick-completed': { tick: number, updaterActions: UpdaterAction[] }
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('update-worker', 'update', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
