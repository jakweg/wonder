import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";

interface ToWorker {
    'connect-to': { address: string }
}

interface FromWorker {
    'state-update': any
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('network-worker2', 'network2', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
