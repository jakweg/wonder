import { UnitShaderCreationOptions } from '../../3d-stuff/renderable/unit/shaders'
import {
	DataOffsetInterruptible,
	DataOffsetWithActivity,
	EntityTrait,
	EntityTraitIndicesRecord,
	requireTrait,
} from '../entities/traits'
import { GameState } from '../game-state'
import { ItemType } from '../world/item'
import * as activityBuildingRoot from './buildingRoot'
import { ActivityId } from './index'
import { InterruptType } from './interrupt'
import * as activityItemPickupRoot from './item-pickup-root'
import * as walkingByPathRoot from './walking-by-path-root'

export const setup = (game: GameState, unit: EntityTraitIndicesRecord) => {
	requireTrait(unit.thisTraits, EntityTrait.Interruptible)

	const withActivitiesMemory = game.entities.withActivities.rawData

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Idle
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] = 0
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord): void => {

	const memory = game.entities.interruptibles.rawData
	const interrupt = memory[unit.interruptible + DataOffsetInterruptible.InterruptType]! as InterruptType
	if (interrupt === InterruptType.None) return

	memory[unit.interruptible + DataOffsetInterruptible.InterruptType]! = InterruptType.None

	switch (interrupt) {
		case InterruptType.Walk: {
			const x = memory[unit.interruptible + DataOffsetInterruptible.ValueA]!
			const y = memory[unit.interruptible + DataOffsetInterruptible.ValueB]!
			walkingByPathRoot.setupToExact(game, unit, x, y)
			break
		}
		case InterruptType.ItemPickUp: {
			const x = memory[unit.interruptible + DataOffsetInterruptible.ValueA]!
			const y = memory[unit.interruptible + DataOffsetInterruptible.ValueB]!
			const type = memory[unit.interruptible + DataOffsetInterruptible.ValueC]! as ItemType
			activityItemPickupRoot.setup(game, unit, x, y, type)
			break
		}
		case InterruptType.BuildSomeBuilding: {
			const id = memory[unit.interruptible + DataOffsetInterruptible.ValueA]!
			activityBuildingRoot.setup(game, unit, id)
			break
		}
		default:
			throw new Error(`Invalid interrupt ${interrupt}`)
	}
}

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
	float additionalZOffset = sin(u_times.x * 2.0) * (isBottomVertex ? -0.18 : -0.06);
	if (isLeftArmVertex)
		pos.x -= additionalZOffset;
	else if (isRightArmVertex)
		pos.x += additionalZOffset;
}
`)
	}

	tmp.push(`
pos.y += sin(u_times.x) * 0.02;
`)
	return tmp.join('\n')
}
