import { GameState } from '../3d-stuff/game-state/game-state'
import { createNewStateUpdater } from '../3d-stuff/game-state/state-updater'
import Mutex, { createMutexFromReceived, createNewMutex } from '../util/mutex'

export let globalMutex: Mutex = createNewMutex()
export const setGlobalMutex = (data: unknown) => {
	globalMutex = createMutexFromReceived(data)
}


export let globalGameState: GameState | null = null
export const setGlobalGameState = (state: GameState | null) => {
	if (globalGameState !== null && state !== null)
		throw new Error('Game is not null')
	globalGameState = state
}

type StateUpdater = ReturnType<typeof createNewStateUpdater>
export let globalStateUpdater: StateUpdater | null = null
export const setGlobalStateUpdater = (u: StateUpdater | null) => {
	if (globalStateUpdater !== null && u !== null)
		throw new Error('Updater is not null')
	globalStateUpdater = u
}


export let globalWorkerDelay = {difference: 0}
