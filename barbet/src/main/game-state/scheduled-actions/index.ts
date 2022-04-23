import { GameState } from '../game-state'
import * as MouseClick from './mouse-click-executor'

export const enum ScheduledActionId {
	MouseClick,
}


export type ScheduledAction = MouseClick.Action

const executors = [
	MouseClick.execute,
]

export const execute = (action: ScheduledAction,
                        game: GameState) => {
	const func = executors[action.type]
	if (func === undefined) throw new Error()
	func(action, game)
}
