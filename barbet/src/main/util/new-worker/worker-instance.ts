import { JS_ROOT } from '@build'

const trustedTypesPolicy = { 'createScriptURL': (name: string) => `${JS_ROOT}/${name}.js` }
const policy = /* @__PURE__ */ (self as any)['trustedTypes']
  ? (self as any)['trustedTypes']['createPolicy']('other', trustedTypesPolicy)
  : trustedTypesPolicy

type ExportedFunction<A, R> = { argument: A; result?: R; transferable?: true }

export type WorkerSpecification<To extends string, From extends string> = {
  scriptName: string
  to: Record<To, ExportedFunction<any, any>>
  from: Record<From, ExportedFunction<any, any>>
}

type ListenersFor<T extends WorkerSpecification<any, any>> = {
  [K in keyof T['from']]: (
    argument: T['from'][K]['argument'],
  ) => Promise<T['from'][K]['result']> | T['from'][K]['result']
}

type LowLevelMessage =
  | { isReply: false; nonce: number; target: string; argument: any }
  | { isReply: true; nonce: number; result: any }

const setupSharedCommunications = <T extends WorkerSpecification<any, any>>(
  s: T,
  listeners: ListenersFor<T>,
  universalPostMessage: (msg: any) => void,
  universalPostMessageWithTransfer: (msg: any, transfer: Transferable[]) => void,
) => {
  const internalListeners = Object.fromEntries(
    Object.entries(listeners).map(([name, handler]) => {
      const processingQueue: any[] = []

      const processNextMessageFromQueue = () => {
        const msg = processingQueue[0]
        if (!msg) return
        ;(async () => {
          try {
            const result = await handler(msg.argument)

            universalPostMessage({
              isReply: true,
              nonce: msg.nonce,
              result: result,
            } satisfies LowLevelMessage)
          } catch (e) {
            console.error(
              'halting handling message',
              msg,
              'at',
              name,
              'in',
              (globalThis as any)['name'] || 'main-frame',
              'due to error',
              e,
            )
            return
          }

          processingQueue.shift()
          processNextMessageFromQueue()
        })()
      }

      return [
        name,
        {
          pushMessage(msg: LowLevelMessage & { isReply: false }): void {
            processingQueue.push(msg)
            if (processingQueue.length !== 1) {
              return
            }
            processNextMessageFromQueue()
          },
        },
      ]
    }),
  )

  const callsSentAwaitingResponse: Map<number, (result: any) => void> = new Map()

  const universalOnMessage = (msg: LowLevelMessage) => {
    if (msg.isReply) {
      const call = callsSentAwaitingResponse.get(msg.nonce)
      if (!call) throw new Error()
      callsSentAwaitingResponse.delete(msg.nonce)
      call(msg.result)
    } else {
      const listener = internalListeners[msg.target]
      if (!listener) {
        console.error('missing handler for', msg)
        return
      }
      listener.pushMessage(msg)
    }
  }

  let nonceCounter = 1
  const senders = Object.fromEntries(
    Object.entries(s.to).map(([name]) => [
      name,
      (argument: any, transfer: Transferable[] | undefined = undefined) => {
        const nonce = nonceCounter++
        return new Promise(resolve => {
          callsSentAwaitingResponse.set(nonce, resolve)

          const msg = {
            isReply: false,
            target: name,
            nonce: nonce,
            argument: argument,
          } satisfies LowLevelMessage
          if (transfer) universalPostMessageWithTransfer(msg, transfer)
          else universalPostMessage(msg)
        })
      },
    ]),
  )

  return { senders, universalOnMessage }
}

export const spawnNew = async <T extends WorkerSpecification<any, any>>(s: T, listeners: ListenersFor<T>) => {
  const worker = new Worker(policy['createScriptURL'](s.scriptName), { 'name': s.scriptName, 'type': 'module' })
  let timeDifference = 0

  await new Promise<void>((resolve, reject) => {
    // worker will send its current time once it's ready
    worker['addEventListener'](
      'message',
      ({ data }) => {
        timeDifference = performance['now']() - (data as any).now
        resolve()
      },
      { 'once': true },
    )
    worker['addEventListener']('error', () => reject('failed to load worker'))
  })

  // worker is loaded, let's start setting up listeners

  const universalPostMessage = (msg: any) => worker['postMessage'](msg)
  const universalPostMessageWithTransfer = (msg: any, transfer: Transferable[]) => worker['postMessage'](msg, transfer)

  const { senders, universalOnMessage } = setupSharedCommunications(
    s,
    listeners,
    universalPostMessage,
    universalPostMessageWithTransfer,
  )

  worker['addEventListener']('message', ({ data }) => {
    universalOnMessage(data as LowLevelMessage)
  })

  return {
    startupTimeDifference: timeDifference,
    functions: senders,
    terminate() {
      worker['terminate']()
    },
  } as {
    startupTimeDifference: number
    functions: {
      [K in keyof T['to']]: T['to'][K]['transferable'] extends true
        ? (argument: T['to'][K]['argument'], transferable: Transferable[]) => Promise<T['to'][K]['result']>
        : (argument: T['to'][K]['argument']) => Promise<T['to'][K]['result']>
    }
    terminate(): void
  }
}

export const bind = <T extends WorkerSpecification<any, any>>(
  s: T,
  listeners: {
    [K in keyof T['to']]: (argument: T['to'][K]['argument']) => Promise<T['to'][K]['result']> | T['to'][K]['result']
  },
) => {
  const now = performance['now']()
  globalThis['postMessage']({ now })

  const universalPostMessage = (msg: any) => globalThis['postMessage'](msg)

  const sCloned = { ...s, to: s.from, from: s.to }
  const { senders, universalOnMessage } = setupSharedCommunications(sCloned, listeners, universalPostMessage)

  globalThis['addEventListener']('message', ({ data }) => {
    universalOnMessage(data as LowLevelMessage)
  })

  return senders as {
    [K in keyof T['from']]: (argument: T['from'][K]['argument']) => Promise<T['from'][K]['result']>
  }
}
