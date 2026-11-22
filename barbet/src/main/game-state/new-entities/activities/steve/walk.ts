import { GameStateImplementation } from '@game'
import { ActivityId } from '@game/new-entities/activities'
import { finishActivity } from '@game/new-entities/activities/runner'
import { WALK_STEPS_MAX, WALK_STEPS_MIN } from '@game/new-entities/activities/steve/constants'
import { InterruptionResolution } from '@game/new-entities/activities/types'
import EntityId from '@game/new-entities/id'
import { Interruption, InterruptionType } from '@game/new-entities/stores/interruptions'
import { getSteveAnimationDuration, SteveAnimationId } from '@game/new-entities/stores/steve-animation'
import { BlockId } from '@game/world/block'
import { Direction, getChangeInXByRotation, getChangeInZByRotation } from '@utils/direction'

export { onAbort, onChildFinished } from '@game/new-entities/activities/defaults'

export interface WalkState {
  stepsRemaining: number
}

const isWalkableStep = (
  game: GameStateImplementation,
  fromX: number,
  fromZ: number,
  currentHeight: number,
  direction: Direction,
): boolean => {
  const deltaX = getChangeInXByRotation(direction)
  const deltaZ = getChangeInZByRotation(direction)
  const nextX = fromX + deltaX
  const nextZ = fromZ + deltaZ

  const nextHeight = game.world.getHighestBlockHeight_orElse(nextX, nextZ, -1)
  if (nextHeight <= 0 || Math.abs(nextHeight - currentHeight) > 1) return false

  const block = game.world.getBlock_unsafe(nextX, nextZ)
  if (block === BlockId.Air || block === BlockId.Water) return false

  if (deltaX !== 0 && deltaZ !== 0) {
    const maxStepHeight = Math.max(currentHeight, nextHeight) + 1
    const sideHeightX = game.world.getHighestBlockHeight_orElse(nextX, fromZ, 0)
    const sideHeightZ = game.world.getHighestBlockHeight_orElse(fromX, nextZ, 0)
    if (sideHeightX > maxStepHeight && sideHeightZ > maxStepHeight) return false
  }

  return true
}

const findWalkDirection = (
  game: GameStateImplementation,
  x: number,
  z: number,
  preferredDirection: Direction,
): Direction | null => {
  const currentHeight = game.world.getHighestBlockHeight_orElse(x, z, 0)

  if (isWalkableStep(game, x, z, currentHeight, preferredDirection)) {
    return preferredDirection
  }

  const startOffset = game.seededRandom.nextInt(7)
  for (let i = 0; i < 7; ++i) {
    const offset = ((startOffset + i) % 7) + 1
    const candidateDirection = ((preferredDirection + offset) & 7) as Direction
    if (isWalkableStep(game, x, z, currentHeight, candidateDirection)) {
      return candidateDirection
    }
  }

  return null
}

const selectWalkAnimation = (heightDelta: number): SteveAnimationId => {
  if (heightDelta > 0) return SteveAnimationId.WalkUp
  if (heightDelta < 0) return SteveAnimationId.WalkDown
  return SteveAnimationId.Walk
}

const beginWalkStep = (
  game: GameStateImplementation,
  self: EntityId,
  x: number,
  z: number,
  direction: Direction,
): number => {
  const currentHeight = game.world.getHighestBlockHeight_orElse(x, z, 0)
  const nextX = x + getChangeInXByRotation(direction)
  const nextZ = z + getChangeInZByRotation(direction)
  const nextHeight = game.world.getHighestBlockHeight_orElse(nextX, nextZ, currentHeight)
  const animationId = selectWalkAnimation(nextHeight - currentHeight)

  game.entities2.setFacing(self, direction, game.currentTick)
  game.entities2.setPosition(self, nextX, nextZ)
  game.entities2.setSteveAnimation(self, animationId, game.currentTick)
  return getSteveAnimationDuration(animationId)
}

export const tryPush = (
  game: GameStateImplementation,
  self: EntityId,
  direction?: Direction,
  steps?: number,
): boolean => {
  const { x, z } = game.entities2.getPosition(self)!
  const preferredDirection = direction ?? (game.seededRandom.nextInt(8) as Direction)
  const chosenDirection = findWalkDirection(game, x, z, preferredDirection)
  if (chosenDirection === null) return false

  const totalSteps = Math.max(1, steps ?? game.seededRandom.nextIntRange(WALK_STEPS_MIN, WALK_STEPS_MAX))
  const stepDuration = beginWalkStep(game, self, x, z, chosenDirection)

  game.entities2.pushActivityFrame<WalkState>(
    self,
    ActivityId.Steve_Walk,
    { stepsRemaining: totalSteps - 1 },
    (game.currentTick + stepDuration) >>> 0,
  )
  return true
}

export const perform = (game: GameStateImplementation, self: EntityId, state: WalkState | undefined): void => {
  if (!state || state.stepsRemaining <= 0 || game.entities2.getPendingInterruption(self) !== undefined) {
    finishActivity(game, self, ActivityId.Steve_Walk, null)
    return
  }

  const { x, z } = game.entities2.getPosition(self)!
  const currentDirection = game.entities2.getFacing(self) ?? Direction.PositiveX
  const chosenDirection = findWalkDirection(game, x, z, currentDirection)
  if (chosenDirection === null) {
    finishActivity(game, self, ActivityId.Steve_Walk, null)
    return
  }

  state.stepsRemaining -= 1
  const stepDuration = beginWalkStep(game, self, x, z, chosenDirection)
  game.entities2.setWakeTick(self, (game.currentTick + stepDuration) >>> 0)
}

export const onInterruption = (
  _game: GameStateImplementation,
  _self: EntityId,
  _state: WalkState | undefined,
  interruption: Interruption,
): InterruptionResolution => {
  return interruption.type === InterruptionType.Die
    ? InterruptionResolution.AbortAndPassToParent
    : InterruptionResolution.Defer
}
