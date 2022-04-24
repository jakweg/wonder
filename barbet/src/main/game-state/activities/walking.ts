import { UnitShaderCreationOptions } from '../../3d-stuff/renderable/unit/shaders'
import { Direction, getChangeInXByRotation, getChangeInZByRotation } from '../../util/direction'
import {
	DataOffsetDrawables,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTrait,
	EntityTraitIndicesRecord,
	hasTrait,
} from '../entities/traits'
import { GameState } from '../game-state'
import { ActivityId } from './index'
import * as activityWalkingByPathRoot from './walking-by-path-root'

const standardWalkingDuration = 15
const crossWalkingDuration = (standardWalkingDuration * Math.SQRT2) | 0
export const walkingDurationByDirection: number[] = [
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
	standardWalkingDuration, crossWalkingDuration,
]

export const walkingVertexTransformationsSource = (options: UnitShaderCreationOptions) => `
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = sin(u_times.y * 20.0 / PI) * (isBottomVertex ? -0.2 : -0.1);
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
	SIZE
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord) => {
	const now = game.currentTick
	const withActivitiesMemory = game.entities.withActivities.rawData
	const activityMemory = game.entities.activitiesMemory.rawData
	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

	if (now === activityMemory[pointer - MemoryField.WalkingFinishTick]!) {
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.WalkingByPathRoot
		activityWalkingByPathRoot.perform(game, unit)
	}
}

export const tryToContinueWalking = (game: GameState, unit: EntityTraitIndicesRecord, direction: Direction): boolean => {
	const positionData = game.entities.positions.rawData
	const posX = positionData[unit.position + DataOffsetPositions.PositionX]!
	// const posY = positionData[unit.position + DataOffsetPositions.PositionY]!
	const posZ = positionData[unit.position + DataOffsetPositions.PositionZ]!

	const dx = posX + getChangeInXByRotation(direction)
	const dz = posZ + getChangeInZByRotation(direction)
	if (!game.tileMetaDataIndex.walkableTester(dx, dz))
		return false

	positionData[unit.position + DataOffsetPositions.PositionX] = dx
	positionData[unit.position + DataOffsetPositions.PositionZ] = dz


	const now = game.currentTick

	const withActivitiesMemory = game.entities.withActivities.rawData
	const memory = game.entities.activitiesMemory.rawData
	const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Walking
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now

	memory[pointer - MemoryField.WalkingDirection] = direction
	memory[pointer - MemoryField.WalkingFinishTick] = now + walkingDurationByDirection[direction]!

	if (hasTrait(unit.thisTraits, EntityTrait.Drawable)) {
		const data = game.entities.drawables.rawData
		const rotation = data[unit.drawable + DataOffsetDrawables.Rotation]!
		data[unit.drawable + DataOffsetDrawables.Rotation] = Direction.FlagMergeWithPrevious | ((rotation & Direction.MaskCurrentRotation) << 3) | direction
	}

	return true
}

