import { Operation } from "../../../game-session";
import { TickQueueAction } from "../../../network/tick-queue-action";
import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    'connect': { address: string }
    'join-room': { roomId: string }
    'set-prevent-joins': { prevent: boolean }
    'set-latency-ticks': { count: number }
    'broadcast-game-state': { serializedState: string }
    'broadcast-my-actions': { tick: number, actions: TickQueueAction[] }
    'broadcast-operation': Operation
}

interface FromWorker {
    'state-update': any
    'connection-made': { success: boolean }
    'connection-dropped': null
    'joined-room': { ok: true, roomId: string } | { ok: false, }
    'got-game-state': { serializedState: string }
    'got-player-actions': { from: string, tick: number, actions: TickQueueAction[] }
    'got-operation': Operation
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('network-worker', 'network', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
