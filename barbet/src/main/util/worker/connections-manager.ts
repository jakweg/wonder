import { createMessageHandler, Message, MessageReceiver, MessageSender, MessageType } from './worker-communication-handler'

let hasControl = false
const replyPort = {
	send: function <T extends MessageType>(type: T, extra: Message[T]) {
		postMessage({ type, extra })
	},
} as MessageSender

/** @deprecated */
export const takeControlOverWorkerConnection = (): (MessageSender & MessageReceiver) => {
	if (hasControl) throw new Error()
	hasControl = true
	const [callback, handler] = createMessageHandler(replyPort)
	onmessage = callback
	replyPort.send('connection-established', { now: performance.now() })
	return { ...replyPort, ...handler }
}
