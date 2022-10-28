export const abortAfterTimeout = (ms: number) => {
    const controller = new AbortController()
    setTimeout(() => controller['abort'](), ms)
    return controller
}

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))

export const measureMillisecondsAsync = async <T>(callback: () => Promise<T>): Promise<[T, number]> => {
    const start = performance.now()
    const result = await callback()
    const end = performance.now()
    return [result, end - start]
}