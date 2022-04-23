import { GameState } from '../game-state'
import { ScheduledActionId } from './'

export type Action = {
	type: ScheduledActionId.MouseClick
}

export const execute = (action: Action, game: GameState) => {
	console.log('executing mouse click', action, 'at tick', game.currentTick)
}
