import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";

interface ToWorker { }

interface FromWorker { }

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('network-worker2', 'network2', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
