import { JS_ROOT } from '../build-info'
import { EMPTY_LIST } from '../util/common'
import Mutex, { Lock } from '../util/mutex'
import { Connection, createMessageHandler, Message, MessageType, setMessageHandler } from './message-handler'


export class WorkerController {
	private constructor(public readonly replier: Connection,
	                    public readonly workerStartDelay: number) {
	}

	public static async spawnNew(scriptName: string,
	                             name: string,
	                             mutex: Mutex) {
		let replier: Connection | null = null
		let delay = 0
		await mutex.executeWithAcquiredAsync(Lock.Update, () => {
			const scriptURL = `${JS_ROOT}/${scriptName}.js`

			const worker = new Worker(scriptURL, {name})

			replier = {
				send<T extends MessageType>(type: T, extra: Message[T], transferable?: Transferable[]) {
					worker.postMessage({type, extra}, transferable ?? (EMPTY_LIST as Transferable[]))
				},
			}

			worker.onmessage = createMessageHandler(replier)

			return new Promise<void>(resolve => {
				setMessageHandler('connection-established', ({now}) => {
					delay = performance.now() - now
					resolve()
				}, true)
			}).then(() => replier?.send('set-global-mutex', {mutex: mutex.pass()}))
		})
		return new WorkerController(replier!, delay)
	}
}
