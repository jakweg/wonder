import { GameStateImplementation } from '@game'
import { ActivityId } from '@game/new-entities/activities'
import { finishActivity } from '@game/new-entities/activities/runner'
import { JUMP_DURATION } from '@game/new-entities/activities/slime/constants'
import EntityId from '@game/new-entities/id'
import { SlimeAnimationId } from '@game/new-entities/stores/slime-animation'
import { Direction, getChangeInXByRotation, getChangeInZByRotation } from '@utils/direction'

export { onAbort, onChildFinished, onInterruptionDefer as onInterruption } from '@game/new-entities/activities/defaults'

export const push = (game: GameStateImplementation, self: EntityId, direction?: Direction): void => {
  const currentDirection = game.entities2.getFacing(self) ?? Direction.PositiveX
  const forwardDirection = direction ?? currentDirection

  const { x, z } = game.entities2.getPosition(self)!
  const currentHeight = game.world.getHighestBlockHeight_orElse(x, z, 0)

  const nextX = x + getChangeInXByRotation(forwardDirection)
  const nextZ = z + getChangeInZByRotation(forwardDirection)
  const nextHeight = game.world.getHighestBlockHeight_orElse(nextX, nextZ, -1)

  if (nextHeight === currentHeight) {
    game.entities2.setFacing(self, forwardDirection)
    game.entities2.setPosition(self, nextX, nextZ)
    game.entities2.setSlimeAnimation(self, SlimeAnimationId.JumpForward, game.currentTick)
  } else {
    const fallbackDirection = direction ?? (game.seededRandom.nextInt(8) as Direction)
    game.entities2.setFacing(self, fallbackDirection)
    game.entities2.setSlimeAnimation(self, SlimeAnimationId.Jump, game.currentTick)
  }

  game.entities2.pushActivityFrame(self, ActivityId.Slime_Jump, undefined, (game.currentTick + JUMP_DURATION) >>> 0)
}

export const perform = (game: GameStateImplementation, self: EntityId, _state: undefined): void => {
  const currentDirection = game.entities2.getFacing(self) ?? Direction.PositiveX
  game.entities2.snapFacing(self, currentDirection)
  const randomJumpRoll = game.seededRandom.nextInt(100)
  finishActivity(game, self, ActivityId.Slime_Jump, randomJumpRoll)
}
