export interface Sender<T> {
    send<K extends keyof T>(type: K, value: T[K], transferable?: Transferable[]): void
}

export interface Receiver<T> {
    on<K extends keyof T>(type: K, callback: (value: T[K]) => void): void

    once<K extends keyof T>(type: K, callback: (value: T[K]) => void): () => void

    await<K extends keyof T>(type: K, signal?: AbortSignal): Promise<T[K]>
}

export const createSender = <T>(worker: { postMessage: any }): Sender<T> => {
    return {
        send(type, value, transferable?) {
            worker['postMessage']({ type, value }, transferable ?? [])
        },
    }
}

export const createReceiver = <T>(worker: { onmessage: null | ((event: MessageEvent) => void) }): Receiver<T> => {
    if (worker['onmessage'] != null)
        throw new Error()

    const listeners: any = {}
    const oneTimeListeners: Map<string, any> = new Map()

    worker['onmessage'] = (event) => {
        const { type, value } = event['data']

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