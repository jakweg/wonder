import { Operation } from "../../../game-session";
import { TickQueueAction } from "../../../network/tick-queue-action";
import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";

export const enum ToWorker {
    Connect,
    JoinRoom,
    SetPreventJoins,
    SetLatencyTicks,
    BroadcastGameState,
    BroadcastMyActions,
    BroadcastOperation,
}

type ToTypes = {
    [ToWorker.Connect]: { address: string }
    [ToWorker.JoinRoom]: { roomId: string }
    [ToWorker.SetPreventJoins]: { prevent: boolean }
    [ToWorker.SetLatencyTicks]: { count: number }
    [ToWorker.BroadcastGameState]: { serializedState: string }
    [ToWorker.BroadcastMyActions]: { tick: number, actions: TickQueueAction[] }
    [ToWorker.BroadcastOperation]: Operation
}

export const enum FromWorker {
    StateUpdate,
    ConnectionMade,
    ConnectionDropped,
    JoinedRoom,
    GotGameState,
    GotPlayerActions,
    GotOperation,
}

interface FromTypes {
    [FromWorker.StateUpdate]: any
    [FromWorker.ConnectionMade]: { success: boolean }
    [FromWorker.ConnectionDropped]: null
    [FromWorker.JoinedRoom]: { ok: true, roomId: string } | { ok: false, }
    [FromWorker.GotGameState]: { serializedState: string }
    [FromWorker.GotPlayerActions]: { from: string, tick: number, actions: TickQueueAction[] }
    [FromWorker.GotOperation]: Operation
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToTypes, FromTypes>('network-worker', 'network', mutex)

export const bind = () => genericBind<FromTypes, ToTypes>()
