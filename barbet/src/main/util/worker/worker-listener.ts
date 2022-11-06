import { createReceiver, createSender, Receiver, Sender } from './message-types/rx-interfaces'
import { SystemMessageTypeFromWorker } from './message-types/system'

const sendPing = (sender: Sender<SystemMessageTypeFromWorker>) => {
  const now = performance['now']()
  sender.send('connection-established', { now })
}

export const genericBind = async <S, R>(): Promise<{ sender: Sender<S>; receiver: Receiver<R> }> => {
  const { start, ...rest } = await delayedBind<S, R>()
  start()
  return rest
}

export const delayedBind = async <S, R>(): Promise<{ sender: Sender<S>; receiver: Receiver<R>; start: () => void }> => {
  const sender = createSender<S & SystemMessageTypeFromWorker>(self)
  const receiver = createReceiver<R>(self)

  let started = false
  const start = () => {
    if (started) throw new Error()
    started = true
    sendPing(sender)
  }

  return { sender, receiver, start }
}
