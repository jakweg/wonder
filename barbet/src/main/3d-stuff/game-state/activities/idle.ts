import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { GameState, Unit } from '../game-state'
import { InterruptType } from './interrupt'
import pathFinderAwaiting from './walking-by-path-root'

const activityIdle = {
	numericId: ActivityId.Idle,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: Unit) {
		const interrupt = unit.interrupt[0]! as InterruptType
		if (interrupt === InterruptType.None) return
		unit.interrupt[0] = InterruptType.None

		if (interrupt === InterruptType.WalkRequest) {
			const x = unit.interrupt[1]!
			const y = unit.interrupt[2]!
			pathFinderAwaiting.setup(game, unit, x, y)
		}
	},
	setup(game: GameState, unit: Unit) {
		unit.activityId = ActivityId.Idle
		unit.activityStartedAt = game.currentTick
		unit.activityMemoryPointer = 0
	},
}
export default activityIdle
