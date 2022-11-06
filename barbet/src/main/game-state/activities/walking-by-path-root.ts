import { Direction } from '../../util/direction'
import { RequestType } from '../delayed-computer/request'
import { PathResult } from '../delayed-computer/result'
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
  Initial,
  WaitingForPath,
  GotPath,
}

const enum MemoryField {
  ReturnToActivity,
  NextPathDirectionIndex,
  PathRequestId,
  Status,
  DestinationX,
  DestinationZ,
  DestinationXMin,
  DestinationZMin,
  DestinationXMax,
  DestinationZMax,
  SIZE,
}

export const perform = (game: GameState, unit: EntityTraitIndicesRecord) => {
  const memory = game.entities.activitiesMemory.rawData
  const withActivitiesMemory = game.entities.withActivities.rawData
  const pointer = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer]! + unit.activityMemory

  const status: Status = memory[pointer - MemoryField.Status]!
  const requestId = memory[pointer - MemoryField.PathRequestId]!
  const path = (game as GameStateImplementation).delayedComputer.getResult(requestId) as PathResult

  switch (status) {
    case Status.Initial: {
      const dx = memory[pointer - MemoryField.DestinationX]!
      const dz = memory[pointer - MemoryField.DestinationZ]!

      const dxMin = memory[pointer - MemoryField.DestinationXMin]!
      const dzMin = memory[pointer - MemoryField.DestinationZMin]!
      const dxMax = memory[pointer - MemoryField.DestinationXMax]!
      const dzMax = memory[pointer - MemoryField.DestinationZMax]!

      const positionData = game.entities.positions.rawData
      const posX = positionData[unit.position + DataOffsetPositions.PositionX]!
      const posZ = positionData[unit.position + DataOffsetPositions.PositionZ]!
      memory[pointer - MemoryField.PathRequestId] = (game as GameStateImplementation).delayedComputer.request({
        id: 0,
        type: RequestType.FindPath,
        startX: posX,
        startZ: posZ,
        destinationXCenter: dx,
        destinationXMin: dxMin,
        destinationXMax: dxMax,
        destinationZCenter: dz,
        destinationZMin: dzMin,
        destinationZMax: dzMax,
      })
      memory[pointer - MemoryField.Status] = Status.WaitingForPath
      return
    }

    case Status.WaitingForPath: {
      if (path === null) return
      if (!path.found || path.directions.length === 0) break

      memory[pointer - MemoryField.Status] = Status.GotPath
      memory[pointer - MemoryField.NextPathDirectionIndex] = 1
      activityWalking.tryToContinueWalking(game, unit, path.directions[0]!)
      return
    }

    case Status.GotPath:
      {
        const canBeInterrupted = (unit.thisTraits & EntityTrait.Interruptible) === EntityTrait.Interruptible
        const wasInterrupted =
          canBeInterrupted &&
          (game.entities.interruptibles.rawData[
            unit.interruptible + DataOffsetInterruptible.InterruptType
          ]! as InterruptType) !== InterruptType.None
        if (!wasInterrupted) {
          if (path !== null) {
            const directionIndex = memory[pointer - MemoryField.NextPathDirectionIndex]++
            if (directionIndex < path.directions.length) {
              const canWalkSuccessfully = activityWalking.tryToContinueWalking(
                game,
                unit,
                path.directions[directionIndex]!,
              )
              if (canWalkSuccessfully) return
            }
          }

          // Path was forgotten or obstacle got in the way
          memory[pointer - MemoryField.Status] = Status.Initial
          return
        }
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

export const setupToExact = (game: GameState, unit: EntityTraitIndicesRecord, x: number, z: number) => {
  setup(game, unit, x, z, x, x, z, z)
}

export const setupToRect = (
  game: GameState,
  unit: EntityTraitIndicesRecord,
  x: number,
  z: number,
  areaSize: number,
) => {
  setup(game, unit, x, z, x - areaSize, x + areaSize, z - areaSize, z + areaSize)
}

export const setup = (
  game: GameState,
  unit: EntityTraitIndicesRecord,
  x: number,
  z: number,
  xMin: number,
  xMax: number,
  zMin: number,
  zMax: number,
) => {
  requireTrait(unit.thisTraits, EntityTrait.Position)

  const withActivitiesMemory = game.entities.withActivities.rawData
  const memory = game.entities.activitiesMemory.rawData

  const pointer =
    (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE) +
    unit.activityMemory

  const returnToActivity = withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId]!
  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.WalkingByPathRoot
  withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick

  if ((unit.thisTraits & EntityTrait.Drawable) === EntityTrait.Drawable)
    game.entities.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation] &= ~Direction.FlagMergeWithPrevious

  memory[pointer - MemoryField.ReturnToActivity] = returnToActivity
  memory[pointer - MemoryField.PathRequestId] = -1
  memory[pointer - MemoryField.Status] = Status.Initial
  memory[pointer - MemoryField.DestinationX] = x
  memory[pointer - MemoryField.DestinationZ] = z
  memory[pointer - MemoryField.DestinationXMin] = xMin
  memory[pointer - MemoryField.DestinationXMax] = xMax
  memory[pointer - MemoryField.DestinationZMin] = zMin
  memory[pointer - MemoryField.DestinationZMax] = zMax
}
