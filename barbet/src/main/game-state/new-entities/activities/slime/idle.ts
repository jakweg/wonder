import { GameStateImplementation } from '@game'
import { ActivityId } from '@game/new-entities/activities'
import * as SlimeJump from '@game/new-entities/activities/slime/jump'
import * as SlimeSlowRotate from '@game/new-entities/activities/slime/slow-rotate'
import {
  IDLE_JOB_CHECK_INTERVAL_MAX,
  IDLE_JOB_CHECK_INTERVAL_MIN,
  JOB_CHANCE_TO_JUMP_INSTEAD_OF_JUST_ROTATE,
} from '@game/new-entities/activities/slime/constants'
import { CompletedChild, InterruptionResolution } from '@game/new-entities/activities/types'
import EntityId from '@game/new-entities/id'
import { Interruption, InterruptionType } from '@game/new-entities/stores/interruptions'
import { SlimeAnimationId } from '@game/new-entities/stores/slime-animation'
import { Direction } from '@utils/direction'

export { onAbort } from '@game/new-entities/activities/defaults'

const computeNextIdleWakeTick = (game: GameStateImplementation): number => {
  const sleepTicks = game.seededRandom.nextIntRange(IDLE_JOB_CHECK_INTERVAL_MIN, IDLE_JOB_CHECK_INTERVAL_MAX)
  return (game.currentTick + sleepTicks) >>> 0
}

export const push = (game: GameStateImplementation, self: EntityId): void => {
  const currentDirection = game.entities2.getFacing(self) ?? Direction.PositiveX
  game.entities2.snapFacing(self, currentDirection)
  game.entities2.setSlimeAnimation(self, SlimeAnimationId.Idle, game.currentTick)
  game.entities2.pushActivityFrame(self, ActivityId.Slime_Idle, undefined, computeNextIdleWakeTick(game))
}

export const perform = (game: GameStateImplementation, self: EntityId, _state: undefined): void => {
  if (game.seededRandom.nextInt(100) < JOB_CHANCE_TO_JUMP_INSTEAD_OF_JUST_ROTATE) {
    SlimeJump.push(game, self)
  } else {
    SlimeSlowRotate.push(game, self)
  }
}

export const onChildFinished = (
  game: GameStateImplementation,
  self: EntityId,
  _state: undefined,
  child: CompletedChild,
): void => {
  if (child.finishedActivityId === ActivityId.Slime_Jump) {
    const _jumpRoll: number = child.result
    console.log('Slime jumped and returned', {_jumpRoll})
  }

  game.entities2.setSlimeAnimation(self, SlimeAnimationId.Idle, game.currentTick)
  game.entities2.setWakeTick(self, computeNextIdleWakeTick(game))
}

export const onInterruption = (
  game: GameStateImplementation,
  self: EntityId,
  _state: undefined,
  interruption: Interruption,
): InterruptionResolution => {
  switch (interruption.type) {
    case InterruptionType.Die:
      game.entities2.markEntityForRemoval(self)
      return InterruptionResolution.Handled

    case InterruptionType.Startle:
    case InterruptionType.Attacked:
      SlimeJump.push(game, self)
      return InterruptionResolution.Handled

    default:
      return InterruptionResolution.Handled
  }
}
