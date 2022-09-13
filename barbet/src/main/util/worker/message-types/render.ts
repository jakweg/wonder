import { TerminateGameArguments } from "../../../entry-points/feature-environments/loader";
import { ScheduledAction } from "../../../game-state/scheduled-actions";
import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";

export const enum ToWorker {
    GameMutex,
    NewSettings,
    FrontendVariables,
    CameraBuffer,
    SetWorkerLoadDelays,
    UpdateEntityContainer,
    TerminateGame,
    TransferCanvas,
    GameCreateResult,
}

interface ToTypes {
    [ToWorker.GameMutex]: any
    [ToWorker.NewSettings]: any
    [ToWorker.FrontendVariables]: { buffer: SharedArrayBuffer }
    [ToWorker.CameraBuffer]: { buffer: SharedArrayBuffer }
    [ToWorker.SetWorkerLoadDelays]: { update: number, render: number }
    [ToWorker.UpdateEntityContainer]: { buffers: SharedArrayBuffer[] }
    [ToWorker.TerminateGame]: TerminateGameArguments
    [ToWorker.TransferCanvas]: { canvas: unknown }
    [ToWorker.GameCreateResult]: { game: unknown, updater: unknown }
}

export const enum FromWorker {
    ScheduledAction,
}

interface FromTypes {
    [FromWorker.ScheduledAction]: ScheduledAction
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToTypes, FromTypes>('render-worker', 'render', mutex)

export const bind = () => genericBind<FromTypes, ToTypes>()
