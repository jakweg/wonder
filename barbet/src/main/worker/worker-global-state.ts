import { GameState } from '../3d-stuff/game-state/game-state'
import { StateUpdater } from '../3d-stuff/game-state/state-updater'
import Mutex from '../util/mutex'

export let globalMutex: Mutex = Mutex.createNew()
export const setGlobalMutex = (data: unknown) => {
	globalMutex = Mutex.fromReceived(data)
}


let globalGameState: GameState | null = null
export const setGlobalGameState = (state: GameState) => {
	if (globalGameState !== null)
		throw new Error('Game is not null')
	globalGameState = state
}
export const requireGameState = () => {
	const state = globalGameState
	if (state === null)
		throw new Error('Game is null')
	return state
}

export let stateUpdater: StateUpdater | null = null
export const setGlobalStateUpdater = (u: StateUpdater) => {
	if (stateUpdater !== null)
		throw new Error('Updater is not null')
	stateUpdater = u
}
