import { UnitShaderCreationOptions } from '../../3d-stuff/renderable/unit/shaders'
import { queryForAnyUnfinishedBuildingId } from '../entities/queries'
import {
	DataOffsetInterruptible,
	DataOffsetWithActivity,
	EntityTrait,
	EntityTraitIndicesRecord,
	requireTrait,
} from '../entities/traits'
import { GameState } from '../game-state'
import * as activityBuildingRoot from './buildingRoot'
import { ActivityId } from './index'
import { interruptBuild, InterruptType } from './interrupt'
import * as walkingByPathRoot from './walking-by-path-root'

const JOB_CHECK_INTERVAL = 5 * 20

const enum MemoryField {
	NextJobAttemptTick,
	SIZE,
}

export const setup = (game: GameState, unit: EntityTraitIndicesRecord) => {
	requireTrait(unit.thisTraits, EntityTrait.Interruptible)

	const withActivitiesMemory = game.entities.withActivities.rawData

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Idle
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] = MemoryField.SIZE
	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
	const memory = game.entities.activitiesMemory.rawData
	memory[pointer - MemoryField.NextJobAttemptTick] = 0
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord): void => {
	const withActivitiesMemory = game.entities.withActivities.rawData
	const interruptibles = game.entities.interruptibles.rawData

	const interrupt = interruptibles[unit.interruptible + DataOffsetInterruptible.InterruptType]! as InterruptType
	if (interrupt !== InterruptType.None) {

		interruptibles[unit.interruptible + DataOffsetInterruptible.InterruptType]! = InterruptType.None

		switch (interrupt) {
			case InterruptType.Walk: {
				const x = interruptibles[unit.interruptible + DataOffsetInterruptible.ValueA]!
				const y = interruptibles[unit.interruptible + DataOffsetInterruptible.ValueB]!
				walkingByPathRoot.setupToExact(game, unit, x, y)
				return
			}
			case InterruptType.BuildSomeBuilding: {
				const id = interruptibles[unit.interruptible + DataOffsetInterruptible.ValueA]!
				activityBuildingRoot.setup(game, unit, id)
				return
			}
			default:
				throw new Error(`Invalid interrupt ${interrupt}`)
		}
	}

	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory
	const memory = game.entities.activitiesMemory.rawData
	const now = game.currentTick
	if (memory[pointer - MemoryField.NextJobAttemptTick]! <= now) {
		memory[pointer - MemoryField.NextJobAttemptTick] = now + JOB_CHECK_INTERVAL

		const unfinishedBuildingId = queryForAnyUnfinishedBuildingId(game.entities)
		if (unfinishedBuildingId !== null) {
			interruptBuild(game.entities, unit, unfinishedBuildingId)
		}

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
