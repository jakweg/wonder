import { JS_ROOT } from '../build-info'
import Mutex, { Lock } from '../mutex'
import {
	createMessageHandler,
	Message,
	MessageReceiver,
	MessageSender,
	MessageType
} from './worker-communication-handler'

const EMPTY_LIST: ReadonlyArray<any> = Object.freeze([])

const trustedTypesPolicy = { 'createScriptURL': (name: string) => `${JS_ROOT}/${name}.js` }
const policy = /* @__PURE__ */ (window as any)['trustedTypes'] ? (window as any)['trustedTypes']['createPolicy']('default', trustedTypesPolicy) : trustedTypesPolicy

/** @deprecated */
export class WorkerController {
	private constructor(private readonly worker: Worker,
		public readonly replier: MessageSender,
		public readonly handler: MessageReceiver,
		public readonly workerStartDelay: number) {
	}

	public static async spawnNew(scriptName: string,
		name: string,
		mutex: Mutex) {
		let delay = 0
		await mutex.enterAsync(Lock.Update)

		const worker = new Worker(policy['createScriptURL'](scriptName), { 'name': name, 'type': 'module' })

		const replier = {
			send<T extends MessageType>(type: T, extra: Message[T], transferable?: Transferable[]) {
				worker['postMessage']({ type, extra }, transferable ?? (EMPTY_LIST as Transferable[]))
			},
		}

		const [onmessage, handler] = createMessageHandler(replier)
		worker['onmessage'] = onmessage

		await new Promise<void>(resolve => {
			handler.listen('connection-established', (data) => {
				delay = performance.now() - data.now
				resolve()
			})
		}).then(() => replier?.send('set-global-mutex', { mutex: mutex.pass() }))

		mutex.unlock(Lock.Update)
		return new WorkerController(worker, replier, handler, delay)
	}

	public terminate(): void {
		this.worker['terminate']?.()
	}
}
