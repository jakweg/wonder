import { JS_ROOT } from '../build-info'
import Mutex, { Lock } from '../util/mutex'
import { Connection, createMessageHandler, Message, MessageType, setMessageHandler } from './message-handler'

const EMPTY_LIST: ReadonlyArray<any> = Object.freeze([])

export class WorkerController {
	private constructor(private readonly worker: Worker,
	                    public readonly replier: Connection,
	                    public readonly workerStartDelay: number) {
	}

	public static async spawnNew(scriptName: string,
	                             name: string,
	                             mutex: Mutex) {
		let delay = 0
		await mutex.enterAsync(Lock.Update)
		const scriptURL = `${JS_ROOT}/${scriptName}.js`

		const worker = new Worker(scriptURL, {'name': name, 'type': 'module'})

		const replier = {
			send<T extends MessageType>(type: T, extra: Message[T], transferable?: Transferable[]) {
				worker['postMessage']({type, extra}, transferable ?? (EMPTY_LIST as Transferable[]))
			},
		}

		worker['onmessage'] = createMessageHandler(replier)

		await new Promise<void>(resolve => {
			setMessageHandler('connection-established', (data) => {
				delay = performance.now() - data.now
				resolve()
			}, true)
		}).then(() => replier?.send('set-global-mutex', {mutex: mutex.pass()}))

		mutex.unlock(Lock.Update)
		return new WorkerController(worker, replier, delay)
	}

	public terminate(): void {
		this.worker['terminate']?.()
	}
}
