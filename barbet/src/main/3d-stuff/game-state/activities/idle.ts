import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId, UnitShaderCreationOptions } from '../../renderable/unit/unit-shaders'
import { GameState, Unit } from '../game-state'
import { InterruptType } from './interrupt'
import activityItemPickupRoot from './item-pickup-root'
import activityWalkingRoot from './walking-by-path-root'

const activityIdle = {
	numericId: ActivityId.Idle,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: Unit) {
		const interrupt = unit.interrupt[0]! as InterruptType
		if (interrupt === InterruptType.None) return
		unit.interrupt[0] = InterruptType.None

		switch (interrupt) {
			case InterruptType.Walk: {
				const x = unit.interrupt[1]!
				const y = unit.interrupt[2]!
				activityWalkingRoot.setup(game, unit, ActivityId.Idle, x, y)
				break
			}
			case InterruptType.ItemPickUp: {
				const x = unit.interrupt[1]!
				const y = unit.interrupt[2]!
				activityItemPickupRoot.setup(game, unit, ActivityId.Idle, x, y)
				break
			}
			default:
				throw new Error(`Invalid interrupt ${interrupt}`)
		}
	},
	setup(game: GameState, unit: Unit) {
		unit.activityId = ActivityId.Idle
		unit.activityStartedAt = game.currentTick
		unit.activityMemoryPointer = 0
	},
}
export default activityIdle

export const idleVertexTransformationsSource = (options: UnitShaderCreationOptions) => {
	const tmp: string[] = []
	if (options.holdingItem) {
		tmp.push(`
if (isLeftArmVertex || isRightArmVertex) {
	pos.x += sin(5.0 / PI / 1.0) * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9 - cos(10.0 / PI / 1.0) * -0.5;
}
`)
	} else {
		tmp.push(`
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = computedSin2 * (isBottomVertex ? -0.18 : -0.06);
	if (isLeftArmVertex)
		pos.x -= additionalZOffset;
	else if (isRightArmVertex)
		pos.x += additionalZOffset;
}
`)
	}

	tmp.push(`
pos.y += computedSin1 * 0.02;
`)
	return tmp.join('\n')
}
