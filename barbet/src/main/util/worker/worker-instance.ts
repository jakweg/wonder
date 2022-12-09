import { JS_ROOT } from '@build'
import { createReceiver, createSender, Receiver, Sender } from './message-types/rx-interfaces'
import { SystemMessageTypeFromWorker } from './message-types/system'

const trustedTypesPolicy = { 'createScriptURL': (name: string) => `${JS_ROOT}/${name}.js` }
const policy = /* @__PURE__ */ (self as any)['trustedTypes']
  ? (self as any)['trustedTypes']['createPolicy']('other', trustedTypesPolicy)
  : trustedTypesPolicy

const startExchange = async <S, R extends SystemMessageTypeFromWorker>(worker: Worker) => {
  const sender = createSender<S>(worker)
  const receiver = createReceiver<R>(worker)

  const receivedData = await receiver.await('connection-established')
  const delay = performance.now() - receivedData.now

  return { sender, receiver, delay }
}

export class WorkerInstance<SendTypes, ReceiveTypes> {
  private constructor(
    private readonly handle: Worker,
    public readonly startDelay: number,
    public readonly send: Sender<SendTypes>,
    public readonly receive: Receiver<ReceiveTypes>,
  ) { }

  public static async spawnNew<S, R>(scriptName: string, name: string): Promise<WorkerInstance<S, R>> {
    const worker = new Worker(policy['createScriptURL'](scriptName), { 'name': name, 'type': 'module' })

    const loadErrorPromise = new Promise((_, reject) => {
      worker['addEventListener']('error', reject)
    })

    const { sender, receiver, delay } = await Promise['race']([
      startExchange<S, R & SystemMessageTypeFromWorker>(worker),
      loadErrorPromise as any,
    ])

    return new WorkerInstance(worker, delay, sender, receiver)
  }

  public terminate(): void {
    this.handle['terminate']()
  }
}
