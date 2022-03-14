import { Connection, createMessageHandler, Message, MessageType } from './message-handler'

let hasControl = false
const replyPort = {
	send: function <T extends MessageType>(type: T, extra: Message[T]) {
		postMessage({'type': type, 'extra': extra})
	},
} as Connection

export const takeControlOverWorkerConnection = () => {
	if (hasControl) throw new Error()
	hasControl = true
	onmessage = createMessageHandler(replyPort)
	replyPort.send('connection-established', {'now': performance.now()})
}
