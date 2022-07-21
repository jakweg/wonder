import { ReceivedGameLayerMessage } from "../../../network/message";
import { NetworkStateType } from "../../../network/network-state";
import Mutex from "../../mutex";
import { NetworkWorkerDispatchAction } from "../network-worker-dispatch-action";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";


interface ToWorker {
    ['new-settings']: any
    ['network-worker-dispatch-action']: NetworkWorkerDispatchAction
}

interface FromWorker {
    ['network-message-received']: ReceivedGameLayerMessage<any>
    ['network-state']: NetworkStateType
}

export const spawnNew = (mutex: Mutex) => WorkerInstance
    .spawnNew<ToWorker, FromWorker>('network-worker', 'network', mutex)

export const bind = () => genericBind<FromWorker, ToWorker>()
