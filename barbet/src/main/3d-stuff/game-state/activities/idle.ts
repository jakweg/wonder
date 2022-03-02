import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId, UnitShaderCreationOptions } from '../../renderable/unit/unit-shaders'
import { GameState } from '../game-state'
import { DataOffsetWithActivity, UnitTraitIndicesRecord } from '../units/units-container'

const activityIdle = {
	numericId: ActivityId.Idle,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: UnitTraitIndicesRecord) {
		// TODO interruption support
		// const interrupt = unit.interrupt[0]! as InterruptType
		// if (interrupt === InterruptType.None) return
		// unit.interrupt[0] = InterruptType.None
		//
		// switch (interrupt) {
		// 	case InterruptType.Walk: {
		// 		const x = unit.interrupt[1]!
		// 		const y = unit.interrupt[2]!
		// 		activityWalkingRoot.setup(game, unit, ActivityId.Idle, x, y, 0)
		// 		break
		// 	}
		// 	case InterruptType.ItemPickUp: {
		// 		const x = unit.interrupt[1]!
		// 		const y = unit.interrupt[2]!
		// 		const type = unit.interrupt[3]! as ItemType
		// 		activityItemPickupRoot.setup(game, unit, ActivityId.Idle, x, y, type)
		// 		break
		// 	}
		// 	default:
		// 		throw new Error(`Invalid interrupt ${interrupt}`)
		// }
	},
	setup(game: GameState, unit: UnitTraitIndicesRecord) {
		const withActivitiesMemory = game.units.withActivities.rawData

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Idle
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] = 0
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
