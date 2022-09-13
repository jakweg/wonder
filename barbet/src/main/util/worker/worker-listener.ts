import { setGlobalMutex } from "./global-mutex";
import { createReceiver, createSender, Receiver, Sender } from "./message-types/rx-interfaces";
import { SystemMessageTypeFromWorker, SystemMessageTypeToWorker } from "./message-types/system";

const sendPing = (sender: Sender<SystemMessageTypeFromWorker>) => {
    const now = performance['now']();
    sender.send('connection-established', { now })
}

const exchangeMutex = async (receiver: Receiver<SystemMessageTypeToWorker>) => {
    const mutex = await receiver.await('set-global-mutex')
    setGlobalMutex(mutex.mutex)
}

export const genericBind = async <S, R>(): Promise<{ sender: Sender<S>; receiver: Receiver<R> }> => {
    const { start, ...rest } = await delayedBind<S, R>()
    start()
    return rest
}

export const delayedBind = async <S, R>(): Promise<{ sender: Sender<S>; receiver: Receiver<R>, start: () => void }> => {

    const sender = createSender<S & SystemMessageTypeFromWorker>(self)
    const receiver = createReceiver<R & SystemMessageTypeToWorker>(self)

    await exchangeMutex(receiver)

    let started = false
    const start = () => {
        if (started) throw new Error()
        started = true
        sendPing(sender)
    }

    return { sender, receiver, start }
}
