import { Direction } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { GameState, Unit } from '../game-state'
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
}

const MEMORY_USED_SIZE = 7

const activityWalkingByPathRoot = {
	numericId: ActivityId.WalkingByPathRoot,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

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
				if (unit.interrupt[0]! as InterruptType === InterruptType.None) {
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
					unit.rotation &= ~Direction.FlagMergeWithPrevious
					unit.activityMemoryPointer -= MEMORY_USED_SIZE
					activityWalkingByPathRoot.setup(game, unit, returnTo, dx, dy, areaSize)
					return
				}
				break
		}

		// finished path
		const returnToActivity: ActivityId = memory[pointer - MemoryField.ReturnToActivity]!
		unit.rotation &= ~Direction.FlagMergeWithPrevious
		unit.activityMemoryPointer -= MEMORY_USED_SIZE
		unit.activityId = returnToActivity
	},
	setup(game: GameState, unit: Unit, returnTo: ActivityId,
	      x: number, z: number, areaSize: number) {
		unit.activityStartedAt = game.currentTick
		unit.activityId = ActivityId.WalkingByPathRoot

		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer = unit.activityMemoryPointer + MEMORY_USED_SIZE

		memory[pointer - MemoryField.ReturnToActivity] = returnTo
		memory[pointer - MemoryField.PathRequestId] = game.pathFinder.requestPath(unit.posX, unit.posZ, x, z, areaSize)
		memory[pointer - MemoryField.Status] = Status.WaitingForPath
		memory[pointer - MemoryField.DestinationX] = x
		memory[pointer - MemoryField.DestinationZ] = z
		memory[pointer - MemoryField.DestinationAreaSize] = areaSize
	},
}

export default activityWalkingByPathRoot
