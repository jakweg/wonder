import { TickQueueAction } from "../../../network2/tick-queue-action";
import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    'connect': { address: string }
    'join-room': { roomId: string }
    'set-prevent-joins': { prevent: boolean }
    'broadcast-game-state': { serializedState: string }
    'broadcast-my-actions': { tick: number, actions: TickQueueAction[] }
}

interface FromWorker {
    'state-update': any
    'connection-made': { success: boolean }
    'connection-dropped': null
    'joined-room': { ok: true, roomId: string } | { ok: false, }
    'got-game-state': { serializedState: string }
    'got-player-actions': { from: string, tick: number, actions: TickQueueAction[] }
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('network-worker2', 'network2', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
