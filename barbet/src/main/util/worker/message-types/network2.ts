import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    'connect': { address: string },
    'join-room': { roomId: string }
}

interface FromWorker {
    'state-update': any,
    'connection-made': { success: boolean }
    'connection-dropped': null,
    'joined-room': { roomId: string }
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('network-worker2', 'network2', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
