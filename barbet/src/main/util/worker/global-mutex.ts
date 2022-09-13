import Mutex, { createMutexFromReceived, createNewMutex } from '../mutex'

/** @deprecated */
export let globalMutex: Mutex = createNewMutex()
/** @deprecated */
export const setGlobalMutex = (data: unknown) => {
	globalMutex = createMutexFromReceived(data)
}
