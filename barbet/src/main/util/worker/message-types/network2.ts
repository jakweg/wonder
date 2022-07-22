import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    'connect': { address: string },
    'join-room': { roomId: string },
    'set-prevent-joins': { prevent: boolean }
}

interface FromWorker {
    'state-update': any,
    'connection-made': { success: boolean }
    'connection-dropped': null,
    'joined-room': { ok: true, roomId: string } | { ok: false, }
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('network-worker2', 'network2', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
