import { Direction } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { GameState, Unit } from '../game-state'
import activityIdle from './idle'
import { InterruptType } from './interrupt'
import activityWalking from './walking'

const enum Status {
	WaitingForPath,
	GotPath
}

const enum MemoryField {
	NextPathDirectionIndex,
	PathRequestId,
	Status,
	DestinationX,
	DestinationZ,
}

const MEMORY_USED_SIZE = 5

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
					const dx = memory[pointer - MemoryField.DestinationX]!
					const dy = memory[pointer - MemoryField.DestinationZ]!
					unit.rotation &= ~Direction.FlagMergeWithPrevious
					unit.activityMemoryPointer -= MEMORY_USED_SIZE
					activityWalkingByPathRoot.setup(game, unit, dx, dy)
					return
				}
				break
		}

		// finished path
		unit.rotation &= ~Direction.FlagMergeWithPrevious
		unit.activityMemoryPointer -= MEMORY_USED_SIZE
		activityIdle.setup(game, unit)
	},
	setup(game: GameState, unit: Unit, x: number, z: number) {
		unit.activityStartedAt = game.currentTick
		unit.activityId = ActivityId.WalkingByPathRoot
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer + MEMORY_USED_SIZE
		unit.activityMemoryPointer = pointer

		memory[pointer - MemoryField.PathRequestId] = game.pathFinder.requestPath(unit.posX, unit.posZ, x, z)
		memory[pointer - MemoryField.Status] = Status.WaitingForPath
		memory[pointer - MemoryField.DestinationX] = x
		memory[pointer - MemoryField.DestinationZ] = z
	},
}

export default activityWalkingByPathRoot
