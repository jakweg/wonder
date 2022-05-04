import Mutex, { createMutexFromReceived, createNewMutex } from '../mutex'

export let globalMutex: Mutex = createNewMutex()
export const setGlobalMutex = (data: unknown) => {
	globalMutex = createMutexFromReceived(data)
}
