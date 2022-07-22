export const abortAfterTimeout = (ms: number) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), ms)
    return controller
}

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))