import { GameStateImplementation } from '@game'
import { ActivityId } from '@game/new-entities/activities'
import { finishActivity } from '@game/new-entities/activities/runner'
import { JUMP_DURATION } from '@game/new-entities/activities/slime/constants'
import EntityId from '@game/new-entities/id'
import { SlimeAnimationId } from '@game/new-entities/stores/slime-animation'
import { Direction } from '@utils/direction'

export { onAbort, onChildFinished, onInterruptionDefer as onInterruption } from '@game/new-entities/activities/defaults'

export const push = (game: GameStateImplementation, self: EntityId, direction?: Direction): void => {
  const targetDirection = direction ?? (game.seededRandom.nextInt(8) as Direction)
  game.entities2.setFacing(self, targetDirection)
  game.entities2.setSlimeAnimation(self, SlimeAnimationId.Jump, game.currentTick)
  game.entities2.pushActivityFrame(
    self,
    ActivityId.Slime_Jump,
    undefined,
    (game.currentTick + JUMP_DURATION) >>> 0,
  )
}

export const perform = (game: GameStateImplementation, self: EntityId, _state: undefined): void => {
  const currentDirection = game.entities2.getFacing(self) ?? Direction.PositiveX
  game.entities2.snapFacing(self, currentDirection)
  const randomJumpRoll = game.seededRandom.nextInt(100)
  finishActivity(game, self, ActivityId.Slime_Jump, randomJumpRoll)
}
