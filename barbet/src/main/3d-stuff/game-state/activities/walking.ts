import { Direction, getChangeInXByRotation, getChangeInZByRotation } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId, UnitShaderCreationOptions } from '../../renderable/unit/unit-shaders'
import { GameState } from '../game-state'
import {
	DataOffsetDrawables,
	DataOffsetPositions,
	DataOffsetWithActivity,
	UnitTraitIndicesRecord,
	UnitTraits,
} from '../units/units-container'
import activityWalkingByPathRoot from './walking-by-path-root'

const standardWalkingDuration = 15
const crossWalkingDuration = (standardWalkingDuration * Math.SQRT2) | 0
export const walkingDurationByDirection: number[] = [
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
]
Object.freeze(walkingDurationByDirection)

export const walkingVertexTransformationsSource = (options: UnitShaderCreationOptions) => `
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = sin(u_time * 20.0 / PI) * (isBottomVertex ? -0.2 : -0.1);
	if (isRightLegVertex ${options.holdingItem ? '' : ` || isLeftArmVertex`})
		pos.x -= additionalZOffset;
	else if (isLeftLegVertex ${options.holdingItem ? '' : ` || isRightArmVertex`})
		pos.x += additionalZOffset;
}
${options.holdingItem ? `
if (isLeftArmVertex || isRightArmVertex) {
	pos.x += sin(5.0 / PI / 1.0) * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9 - cos(10.0 / PI / 1.0) * -0.5;
}
` : ''}
worldPosition += rotationVectors[unitRotationAsInt] * (activityDuration / walkingDurations[unitRotationAsInt]) - rotationVectors[unitRotationAsInt];
`

const enum MemoryField {
	WalkingFinishTick,
	WalkingDirection,
}

const MEMORY_USED_SIZE = 2

const activityWalking = {
	numericId: ActivityId.Walking,
	shaderId: ShaderId.Walking,
	perform(game: GameState, unit: UnitTraitIndicesRecord) {
		const now = game.currentTick
		const withActivitiesMemory = game.units.withActivities.rawData
		const activityMemory = game.units.activitiesMemory.rawData
		const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]!

		if (now === activityMemory[pointer - MemoryField.WalkingFinishTick]!) {
			withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MEMORY_USED_SIZE
			withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.WalkingByPathRoot
			activityWalkingByPathRoot.perform(game, unit)
		}
	},
	tryToContinueWalking(game: GameState, unit: UnitTraitIndicesRecord, direction: Direction): boolean {
		const positionData = game.units.positions.rawData
		const posX = positionData[unit.position + DataOffsetPositions.PositionX]!
		const posY = positionData[unit.position + DataOffsetPositions.PositionY]!
		const posZ = positionData[unit.position + DataOffsetPositions.PositionZ]!

		const dx = posX + getChangeInXByRotation(direction)
		const dz = posZ + getChangeInZByRotation(direction)
		if (posY !== game.world.getHighestBlockHeight(dx, dz) + 1)
			return false

		positionData[unit.position + DataOffsetPositions.PositionX] = dx
		positionData[unit.position + DataOffsetPositions.PositionZ] = dz


		const now = game.currentTick

		const withActivitiesMemory = game.units.withActivities.rawData
		const memory = game.units.activitiesMemory.rawData
		const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MEMORY_USED_SIZE)

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Walking
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now

		memory[pointer - MemoryField.WalkingDirection] = direction
		memory[pointer - MemoryField.WalkingFinishTick] = now + walkingDurationByDirection[direction]!

		if ((unit.thisTraits & UnitTraits.Drawable) === UnitTraits.Drawable) {
			const data = game.units.drawables.rawData
			const rotation = data[unit.drawable + DataOffsetDrawables.Rotation]!
			data[unit.drawable + DataOffsetDrawables.Rotation] = Direction.FlagMergeWithPrevious | ((rotation & Direction.MaskCurrentRotation) << 3) | direction
		}

		return true
	},
}

export default activityWalking
