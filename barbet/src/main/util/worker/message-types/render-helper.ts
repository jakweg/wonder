import Mutex from "../../mutex";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";

export const enum ToWorker {
}

type ToTypes = {
}

export const enum FromWorker {
}

interface FromTypes {
}

export const spawnNew = (mutex: Mutex, id: number) => WorkerInstance
    .spawnNew<ToTypes, FromTypes>('render-helper-worker', `render-helper-${id}`, mutex)

export const bind = () => genericBind<FromTypes, ToTypes>()
