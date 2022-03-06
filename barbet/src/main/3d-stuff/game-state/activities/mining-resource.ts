import { Direction } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId, UnitShaderCreationOptions } from '../../renderable/unit/unit-shaders'
import { RotationZMatrix } from '../../shader/common'
import { DataOffsetDrawables, DataOffsetWithActivity, EntityTraitIndicesRecord } from '../entities/traits'
import { GameState } from '../game-state'

const miningDuration = 20

export const miningResourceTransformationsSource = (_: UnitShaderCreationOptions) => `
if (isLeftArmVertex) {
	float r = abs(sin(activityDuration / PI / 2.0 * ${miningDuration.toFixed(1)}) * (isBottomVertex ? 1.9 : 1.5)) - 0.2;
	mat4 handRotation = ${RotationZMatrix('r')};
	pos = (handRotation * vec4(pos, 1.0)).xyz;
}
`

const enum MemoryField {
	ActivityFinishTick,
	Direction,
	SIZE,
}

const activityMiningResource = {
	numericId: ActivityId.MiningResource,
	shaderId: ShaderId.MiningResource,
	perform(game: GameState, unit: EntityTraitIndicesRecord) {
	},
	setup(game: GameState, unit: EntityTraitIndicesRecord, direction: Direction) {
		const now = game.currentTick
		const memory = game.entities.activitiesMemory.rawData
		const withActivitiesMemory = game.entities.withActivities.rawData
		const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE)

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.MiningResource

		const drawablesData = game.entities.drawables.rawData
		const oldRotation = drawablesData[unit.drawable + DataOffsetDrawables.Rotation]!
		drawablesData[unit.drawable + DataOffsetDrawables.Rotation] = Direction.FlagMergeWithPrevious | ((oldRotation & Direction.MaskCurrentRotation) << 3) | direction

		memory[pointer - MemoryField.ActivityFinishTick] = now + miningDuration
		memory[pointer - MemoryField.Direction] = direction
	},
}

export default activityMiningResource
