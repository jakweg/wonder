import { JS_ROOT } from '../build-info'
import Mutex, { Lock } from '../util/mutex'
import { Connection, createMessageHandler, Message, MessageType, setMessageHandler } from './message-handler'


export class UpdateWorkerController {
	private constructor(public readonly replier: Connection,
	                    public readonly workerStartDelay: number) {
	}

	public static async spawnNew(mutex: Mutex) {
		let replier: Connection | null = null
		let delay = 0
		await mutex.executeWithAcquiredAsync(Lock.Update, () => {
			const scriptURL = `${JS_ROOT}/worker.js`

			const worker = new Worker(scriptURL, {name: 'update'})

			replier = {
				send<T extends MessageType>(type: T, extra: Message[T]) {
					worker.postMessage({type, extra})
				},
			}

			worker.onmessage = createMessageHandler(replier)

			return new Promise<void>(resolve => {
				setMessageHandler('connection-established', ({now}) => {
					delay = performance.now() - now
					resolve()
				})
			}).then(() => replier?.send('set-global-mutex', {mutex: mutex.pass()}))
		})
		return new UpdateWorkerController(replier!, delay)
	}
}
