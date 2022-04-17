import { Direction } from '../../util/direction'
import {
	DataOffsetDrawables,
	DataOffsetInterruptible,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTrait,
	EntityTraitIndicesRecord,
	requireTrait,
} from '../entities/traits'
import { GameState, GameStateImplementation } from '../game-state'
import { ActivityId } from './index'
import { InterruptType } from './interrupt'
import * as activityWalking from './walking'

const enum Status {
	WaitingForPath,
	GotPath
}

const enum MemoryField {
	ReturnToActivity,
	NextPathDirectionIndex,
	PathRequestId,
	Status,
	DestinationX,
	DestinationZ,
	DestinationAreaSize,
	SIZE
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord) => {
	const memory = game.entities.activitiesMemory.rawData
	const withActivitiesMemory = game.entities.withActivities.rawData
	const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

	const status: Status = memory[pointer - MemoryField.Status]!
	const requestId = memory[pointer - MemoryField.PathRequestId]!
	const path = (game as GameStateImplementation)
		.pathFinder.getComputedPath(requestId)

	switch (status) {
		case Status.WaitingForPath:
			if (path === undefined) return
			if (!path['found'] || path['directions'].length === 0) break

			memory[pointer - MemoryField.Status] = Status.GotPath
			memory[pointer - MemoryField.NextPathDirectionIndex] = 1
			activityWalking.tryToContinueWalking(game, unit, path['directions'][0]!)
			return

		case Status.GotPath:
			const canBeInterrupted = (unit.thisTraits & EntityTrait.Interruptible) === EntityTrait.Interruptible
			const wasInterrupted = canBeInterrupted && game.entities.interruptibles.rawData[unit.interruptible + DataOffsetInterruptible.InterruptType]! as InterruptType !== InterruptType.None
			if (!wasInterrupted) {
				if (path !== undefined) {
					const directionIndex = memory[pointer - MemoryField.NextPathDirectionIndex]++
					if (directionIndex < path['directions'].length) {
						const canWalkSuccessfully = activityWalking.tryToContinueWalking(game, unit, path['directions'][directionIndex]!)
						if (canWalkSuccessfully)
							return
					}
				}


				// Path was forgotten or obstacle got in the way
				const dx = memory[pointer - MemoryField.DestinationX]!
				const dz = memory[pointer - MemoryField.DestinationZ]!
				const areaSize = memory[pointer - MemoryField.DestinationAreaSize]!

				if ((unit.thisTraits & EntityTrait.Drawable) === EntityTrait.Drawable)
					game.entities.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation] &= ~Direction.FlagMergeWithPrevious

				const positionData = game.entities.positions.rawData
				const posX = positionData[unit.position + DataOffsetPositions.PositionX]!
				const posZ = positionData[unit.position + DataOffsetPositions.PositionZ]!
				memory[pointer - MemoryField.PathRequestId] = (game as GameStateImplementation)
					.pathFinder.requestPath(posX, posZ, dx, dz, areaSize)
				memory[pointer - MemoryField.Status] = Status.WaitingForPath
				return
			}
			break
	}

	// finished path
	const returnToActivity: ActivityId = memory[pointer - MemoryField.ReturnToActivity]!

	if ((unit.thisTraits & EntityTrait.Drawable) === EntityTrait.Drawable)
		game.entities.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation] &= ~Direction.FlagMergeWithPrevious

	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = returnToActivity
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
}

export const setup = (game: GameState, unit: EntityTraitIndicesRecord,
                      x: number, z: number, areaSize: number) => {
	requireTrait(unit.thisTraits, EntityTrait.Position)

	const positionData = game.entities.positions.rawData
	const withActivitiesMemory = game.entities.withActivities.rawData
	const memory = game.entities.activitiesMemory.rawData

	const posX = positionData[unit.position + DataOffsetPositions.PositionX]!
	const posZ = positionData[unit.position + DataOffsetPositions.PositionZ]!

	const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) + unit.activityMemory

	const returnToActivity = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId]!
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.WalkingByPathRoot
	withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick

	memory[pointer - MemoryField.ReturnToActivity] = returnToActivity
	memory[pointer - MemoryField.PathRequestId] = (game as GameStateImplementation)
		.pathFinder.requestPath(posX, posZ, x, z, areaSize)
	memory[pointer - MemoryField.Status] = Status.WaitingForPath
	memory[pointer - MemoryField.DestinationX] = x
	memory[pointer - MemoryField.DestinationZ] = z
	memory[pointer - MemoryField.DestinationAreaSize] = areaSize
}
