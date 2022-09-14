import { CreateGameArguments, TerminateGameArguments } from "../../../entry-points/feature-environments/loader";
import { SaveGameArguments, SaveGameResult } from "../../../game-state/world/world-saver";
import { TickQueueAction, UpdaterAction } from "../../../network/tick-queue-action";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


export const enum ToWorker {
    GameMutex,
    NewSettings,
    CreateGame,
    SaveGame,
    TerminateGame,
    AppendToTickQueue,
    SetPlayerIds,
}

interface ToTypes {
    [ToWorker.GameMutex]: any
    [ToWorker.NewSettings]: any
    [ToWorker.CreateGame]: CreateGameArguments
    [ToWorker.SaveGame]: SaveGameArguments
    [ToWorker.TerminateGame]: TerminateGameArguments
    [ToWorker.AppendToTickQueue]: { actions: TickQueueAction[], playerId: string, forTick: number }
    [ToWorker.SetPlayerIds]: { playerIds: string[] }
}

export const enum FromWorker {
    GameCreateResult,
    UpdateEntityContainer,
    GameSaved,
    TickCompleted,
}

interface FromTypes {
    [FromWorker.GameCreateResult]: { game: unknown, updater: unknown }
    [FromWorker.UpdateEntityContainer]: { buffers: SharedArrayBuffer[] }
    [FromWorker.GameSaved]: SaveGameResult | false
    [FromWorker.TickCompleted]: { tick: number, updaterActions: UpdaterAction[] }
}

export const spawnNew = () => WorkerInstance
    .spawnNew<ToTypes, FromTypes>('update-worker', 'update')

export const bind = () => genericBind<FromTypes, ToTypes>()
