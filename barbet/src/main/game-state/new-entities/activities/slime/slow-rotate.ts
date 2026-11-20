import { GameStateImplementation } from '@game'
import { ActivityId } from '@game/new-entities/activities'
import { finishActivity } from '@game/new-entities/activities/runner'
import { SLOW_ROTATE_DURATION } from '@game/new-entities/activities/slime/constants'
import { InterruptionResolution } from '@game/new-entities/activities/types'
import EntityId from '@game/new-entities/id'
import { Interruption, InterruptionType } from '@game/new-entities/stores/interruptions'
import { SlimeAnimationId } from '@game/new-entities/stores/slime-animation'
import { Direction } from '@utils/direction'

export { onChildFinished } from '@game/new-entities/activities/defaults'

export const push = (game: GameStateImplementation, self: EntityId, direction?: Direction): void => {
  const targetDirection = direction ?? (game.seededRandom.nextInt(8) as Direction)
  game.entities2.setFacing(self, targetDirection)
  game.entities2.setSlimeAnimation(self, SlimeAnimationId.SlowRotate, game.currentTick)
  game.entities2.pushActivityFrame(
    self,
    ActivityId.Slime_SlowRotate,
    undefined,
    (game.currentTick + SLOW_ROTATE_DURATION) >>> 0,
  )
}

export const perform = (game: GameStateImplementation, self: EntityId, _state: undefined): void => {
  const currentDirection = game.entities2.getFacing(self) ?? Direction.PositiveX
  game.entities2.snapFacing(self, currentDirection)
  finishActivity(game, self, ActivityId.Slime_SlowRotate, null)
}

export const onInterruption = (
  _game: GameStateImplementation,
  _self: EntityId,
  _state: undefined,
  interruption: Interruption,
): InterruptionResolution => {
  switch (interruption.type) {
    case InterruptionType.Die:
      return InterruptionResolution.AbortAndPassToParent
    default:
      return InterruptionResolution.Defer
  }
}

export const onAbort = (game: GameStateImplementation, self: EntityId, _state: undefined): void => {
  const currentDirection = game.entities2.getFacing(self) ?? Direction.PositiveX
  game.entities2.snapFacing(self, currentDirection)
}
