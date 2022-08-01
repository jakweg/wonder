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

    const listeners: Map<keyof T, any> = new Map()
    const oneTimeListeners: Map<keyof T, any> = new Map()

    worker['onmessage'] = (event) => {
        const { type, value } = event['data']

        let callback = oneTimeListeners['get'](type)
        let isOneTime = true
        if (callback === undefined) {
            callback = listeners['get'](type)
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
            if (listeners['has'](type))
                throw new Error(`Reasign listener ${String(type)}`)

            listeners['set'](type, callback)
        },
        once(type, callback) {
            if (oneTimeListeners['has'](type))
                throw new Error(`Already waiting ${String(type)}`)

            oneTimeListeners.set(type, callback)
            return () => {
                if (oneTimeListeners['get'](type) === callback)
                    oneTimeListeners['delete'](type)
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