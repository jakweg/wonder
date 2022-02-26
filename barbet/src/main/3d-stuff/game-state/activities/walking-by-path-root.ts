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

const MEMORY_USED_SIZE = 5

const activityWalkingByPathRoot = {
	numericId: ActivityId.WalkingByPathRoot,
	shaderId: ShaderId.Idle,
	perform(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

		const status: Status = memory[pointer - 3]!
		const requestId = memory[pointer - 2]!
		const path = game.pathFinder.getComputedPath(requestId)

		switch (status) {
			case Status.WaitingForPath:
				if (path === undefined) return
				if (!path.found || path.directions.length === 0) break

				memory[pointer - 3] = Status.GotPath
				memory[pointer - 1] = 1
				activityWalking.startWalking(game, unit, path.directions[0]!)
				return

			case Status.GotPath:
				if (unit.interrupt[0]! as InterruptType === InterruptType.None) {
					if (path === undefined) {
						// Path was forgotten
						const dx = memory[pointer - 4]!
						const dy = memory[pointer - 5]!
						unit.rotation &= ~Direction.FlagMergeWithPrevious
						unit.activityMemoryPointer -= MEMORY_USED_SIZE
						activityWalkingByPathRoot.setup(game, unit, dx, dy)
						return
					}
					const directionIndex = memory[pointer - 1]++
					if (directionIndex < path.directions.length) {
						activityWalking.continueWalking(game, unit, path.directions[directionIndex]!)
						return
					}
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
		memory[pointer - 2] = game.pathFinder.requestPath(unit.posX, unit.posZ, x, z)
		memory[pointer - 3] = Status.WaitingForPath
		memory[pointer - 4] = x
		memory[pointer - 5] = z
	},
}

export default activityWalkingByPathRoot
