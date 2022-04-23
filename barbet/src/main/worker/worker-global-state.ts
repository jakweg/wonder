import { GameState } from '../game-state/game-state'
import { StateUpdaterImplementation } from '../game-state/state-updater/implementation'
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

export let globalStateUpdater: StateUpdaterImplementation | null = null
export const setGlobalStateUpdater = (u: StateUpdaterImplementation | null) => {
	if (globalStateUpdater !== null && u !== null)
		throw new Error('Updater is not null')
	globalStateUpdater = u
}


export let globalWorkerDelay = {difference: 0}
