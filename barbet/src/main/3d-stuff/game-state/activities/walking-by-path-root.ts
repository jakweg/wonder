import { Direction } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { GameState } from '../game-state'
import {
	DataOffsetDrawables,
	DataOffsetInterruptible,
	DataOffsetPositions,
	DataOffsetWithActivity,
	requireTrait,
	UnitTraitIndicesRecord,
	UnitTraits,
} from '../units/traits'
import { InterruptType } from './interrupt'
import activityWalking from './walking'

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

const activityWalkingByPathRoot = {
	numericId: ActivityId.WalkingByPathRoot,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: UnitTraitIndicesRecord) {
		const memory = game.units.activitiesMemory.rawData
		const withActivitiesMemory = game.units.withActivities.rawData
		const pointer = unit.activityMemory + withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]!

		const status: Status = memory[pointer - MemoryField.Status]!
		const requestId = memory[pointer - MemoryField.PathRequestId]!
		const path = game.pathFinder.getComputedPath(requestId)

		switch (status) {
			case Status.WaitingForPath:
				if (path === undefined) return
				if (!path.found || path.directions.length === 0) break

				memory[pointer - MemoryField.Status] = Status.GotPath
				memory[pointer - MemoryField.NextPathDirectionIndex] = 1
				activityWalking.tryToContinueWalking(game, unit, path.directions[0]!)
				return

			case Status.GotPath:
				const canBeInterrupted = (unit.thisTraits & UnitTraits.Interruptible) === UnitTraits.Interruptible
				const wasInterrupted = canBeInterrupted && game.units.interruptibles.rawData[unit.interruptible + DataOffsetInterruptible.InterruptType]! as InterruptType !== InterruptType.None
				if (!wasInterrupted) {
					if (path !== undefined) {
						const directionIndex = memory[pointer - MemoryField.NextPathDirectionIndex]++
						if (directionIndex < path.directions.length) {
							const canWalkSuccessfully = activityWalking.tryToContinueWalking(game, unit, path.directions[directionIndex]!)
							if (canWalkSuccessfully)
								return
						}
					}


					// Path was forgotten or obstacle got in the way
					const returnTo = memory[pointer - MemoryField.ReturnToActivity]!
					const dx = memory[pointer - MemoryField.DestinationX]!
					const dy = memory[pointer - MemoryField.DestinationZ]!
					const areaSize = memory[pointer - MemoryField.DestinationAreaSize]!

					if ((unit.thisTraits & UnitTraits.Drawable) === UnitTraits.Drawable)
						game.units.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation] &= ~Direction.FlagMergeWithPrevious

					withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
					activityWalkingByPathRoot.setup(game, unit, returnTo, dx, dy, areaSize)
					return
				}
				break
		}

		// finished path
		const returnToActivity: ActivityId = memory[pointer - MemoryField.ReturnToActivity]!

		if ((unit.thisTraits & UnitTraits.Drawable) === UnitTraits.Drawable)
			game.units.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation] &= ~Direction.FlagMergeWithPrevious

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = returnToActivity
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] -= MemoryField.SIZE
	},
	setup(game: GameState, unit: UnitTraitIndicesRecord, returnTo: ActivityId,
	      x: number, z: number, areaSize: number) {
		requireTrait(unit.thisTraits, UnitTraits.Position)

		const positionData = game.units.positions.rawData
		const posX = positionData[unit.position + DataOffsetPositions.PositionX]!
		const posZ = positionData[unit.position + DataOffsetPositions.PositionZ]!

		const withActivitiesMemory = game.units.withActivities.rawData
		const memory = game.units.activitiesMemory.rawData
		const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE)

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.WalkingByPathRoot
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick

		memory[pointer - MemoryField.ReturnToActivity] = returnTo
		memory[pointer - MemoryField.PathRequestId] = game.pathFinder.requestPath(posX, posZ, x, z, areaSize)
		memory[pointer - MemoryField.Status] = Status.WaitingForPath
		memory[pointer - MemoryField.DestinationX] = x
		memory[pointer - MemoryField.DestinationZ] = z
		memory[pointer - MemoryField.DestinationAreaSize] = areaSize
	},
}

export default activityWalkingByPathRoot
