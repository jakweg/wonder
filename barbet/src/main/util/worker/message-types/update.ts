import { CreateGameArguments, FeedbackEvent, SaveGameArguments, TerminateGameArguments } from "../../../entry-points/feature-environments/loader";
import { ScheduledAction } from "../../../game-state/scheduled-actions";
import { TickQueueAction } from "../../../network/tick-queue-action";
import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    'new-settings': any
    'create-game': CreateGameArguments
    'save-game': SaveGameArguments
    'terminate-game': TerminateGameArguments
    'append-to-tick-queue': { actions: TickQueueAction[], playerId: number, forTick: number }
}

interface FromWorker {
    'feedback': FeedbackEvent
    'scheduled-action': ScheduledAction
    'game-snapshot-for-renderer': { game: unknown, updater: unknown }
    'update-entity-container': { buffers: SharedArrayBuffer[] }
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('update-worker', 'update', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
