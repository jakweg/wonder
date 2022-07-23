import { TerminateGameArguments } from "../../../entry-points/feature-environments/loader";
import { ScheduledAction } from "../../../game-state/scheduled-actions";
import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    'new-settings': any
    'frontend-variables': { buffer: SharedArrayBuffer }
    'camera-buffer': { buffer: SharedArrayBuffer }
    'set-worker-load-delays': { update: number, render: number }
    'update-entity-container': { buffers: SharedArrayBuffer[] }
    'terminate-game': TerminateGameArguments
    'transfer-canvas': { canvas: unknown }
    'game-snapshot-for-renderer': { game: unknown, updater: unknown }
}

interface FromWorker {
    'scheduled-action': ScheduledAction
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('render-worker', 'render', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
