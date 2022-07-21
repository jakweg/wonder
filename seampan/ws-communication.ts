import { BothWayPackets } from "./packet-types"

export interface Sender<T> {
    send<K extends keyof T>(type: K, value: T[K]): void
}

export interface Receiver<T> {
    on<K extends keyof T>(type: K, callback: (value: T[K]) => void): void

    once<K extends keyof T>(type: K, callback: (value: T[K]) => void): () => void

    await<K extends keyof T>(type: K, signal?: AbortSignal): Promise<T[K]>
}

interface CloseResult {
    error: boolean
}
export interface ConnectionListener {
    awaitConnected(): Promise<void>

    awaitDisconnected(): Promise<CloseResult>

    close(): void
}

const createSender = <T>(ws: WebSocket): Sender<T> => {
    return {
        send(type, value) {
            if (ws['readyState'] !== ws.OPEN)
                throw new Error('not connected')
            ws['send'](JSON.stringify({ type, value }))
        },
    }
}

const createReceiver = <T>(ws: { onmessage: null | ((event: MessageEvent) => void) }): Receiver<T> => {
    if (ws['onmessage'] != null)
        throw new Error()

    const listeners: any = {}
    const oneTimeListeners: Map<string, any> = new Map()

    ws['onmessage'] = (event) => {
        const { type, value } = JSON.parse(event['data'])

        let callback = oneTimeListeners['get'](type)
        let isOneTime = true
        if (callback === undefined) {
            callback = listeners[type]
            isOneTime = false
        }

        if (callback === undefined)
            throw new Error(`Missing handler for ${type}`)

        if (isOneTime)
            oneTimeListeners['delete'](type)

        callback(value)
    }


    return {
        on(type, callback) {
            if (listeners[type] !== undefined)
                throw new Error(`Reasign listener ${String(type)}`)

            listeners[type] = callback
        },
        once(type, callback) {
            if (oneTimeListeners['has'](String(type)))
                throw new Error(`Already waiting ${String(type)}`)

            oneTimeListeners.set(String(type), callback)
            return () => {
                if (oneTimeListeners['get'](String(type)) === callback)
                    oneTimeListeners['delete'](String(type))
            }
        },
        await(type, signal) {
            return new Promise((resolve, reject) => {
                const cancel = this.once(type, resolve)
                signal?.['addEventListener']?.('abort', () => {
                    cancel()
                    reject()
                }, { 'once': true })
            })
        },
    }
}

const createConnectionListener = (ws: WebSocket): ConnectionListener => {
    let erroredConnection = false
    const connectedPromises: any[] = []
    const disconnectedPromises: any[] = []

    ws['addEventListener']('error', () => {
        erroredConnection = true
    })
    ws['addEventListener']('close', () => {
        connectedPromises.forEach(e => e[1]())
        disconnectedPromises.forEach(e => e())
    })
    ws['addEventListener']('open', () => {
        connectedPromises.forEach(e => e[0]())
    })

    return {
        awaitConnected() {
            if (ws.readyState === ws.OPEN)
                return Promise.resolve()

            if (ws.readyState === ws.CONNECTING)
                return new Promise((resolve, reject) => connectedPromises.push([resolve, reject]))

            return Promise.reject('already disconnected')
        },
        awaitDisconnected() {
            if (ws.readyState === ws.CLOSED || ws.CLOSING)
                return Promise.resolve({ error: erroredConnection })

            return new Promise((resolve) => disconnectedPromises.push(resolve))
        },
        close() {
            ws.close()
        },
    }
}

export interface WrappedWebsocket<S, R> {
    send: Sender<S>
    receive: Receiver<R>
    connection: ConnectionListener
}

export const wrapWebsocket = <S, R>(ws: WebSocket): WrappedWebsocket<S, R> => {
    return {
        send: createSender(ws),
        receive: createReceiver(ws),
        connection: createConnectionListener(ws)
    }
}

export const attachPingHandling = (ws: WrappedWebsocket<BothWayPackets, BothWayPackets>) => {
    let lastMeasured: number = Infinity
    ws.receive.on('ping', ({ noonce }) => {
        ws.send.send('pong', { noonce })
    })

    ws.receive.on('pong', ({ noonce }) => {
        lastMeasured = performance['now']() - noonce
    })

    return {
        send(): void {
            ws.send.send('ping', { noonce: performance['now']() })
        },
        lastMeasured(): number {
            return lastMeasured
        }
    }
}