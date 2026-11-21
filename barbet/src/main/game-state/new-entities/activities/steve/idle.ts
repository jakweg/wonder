import { GameStateImplementation } from '@game'
import { ActivityId } from '@game/new-entities/activities'
import {
  IDLE_ACTION_INTERVAL_MAX,
  IDLE_ACTION_INTERVAL_MIN,
  IDLE_GLANCE_RETURN_CENTER_CHANCE,
  IDLE_WALK_CHANCE,
  IDLE_WAVE_HAND_CHANCE,
} from '@game/new-entities/activities/steve/constants'
import * as SteveWalk from '@game/new-entities/activities/steve/walk'
import * as SteveWavingHand from '@game/new-entities/activities/steve/waving-hand'
import { CompletedChild, InterruptionResolution } from '@game/new-entities/activities/types'
import EntityId from '@game/new-entities/id'
import { Interruption, InterruptionType } from '@game/new-entities/stores/interruptions'
import {
  STEVE_CENTER_HEAD_POSE,
  STEVE_HEAD_MAX_PITCH,
  STEVE_HEAD_MAX_YAW,
  SteveAnimationId,
} from '@game/new-entities/stores/steve-animation'
import { Direction, getRotationByChangeInCoords } from '@utils/direction'

export { onAbort } from '@game/new-entities/activities/defaults'

const computeNextIdleWakeTick = (game: GameStateImplementation): number => {
  const sleepTicks = game.seededRandom.nextIntRange(IDLE_ACTION_INTERVAL_MIN, IDLE_ACTION_INTERVAL_MAX)
  return (game.currentTick + sleepTicks) >>> 0
}

const snapCurrentFacing = (game: GameStateImplementation, self: EntityId): void => {
  game.entities2.snapFacing(self, game.entities2.getFacing(self) ?? Direction.PositiveX)
}

const pickIdleHeadLook = (game: GameStateImplementation, self: EntityId): void => {
  const currentTargetPose = game.entities2.getSteveTargetHeadPosePacked(self)
  if (
    currentTargetPose !== STEVE_CENTER_HEAD_POSE &&
    game.seededRandom.nextInt(100) < IDLE_GLANCE_RETURN_CENTER_CHANCE
  ) {
    game.entities2.setSteveHeadLook(self, 0, 0, game.currentTick)
    return
  }

  const targetYaw = (game.seededRandom.next() * 2 - 1) * (STEVE_HEAD_MAX_YAW * 0.9)
  const targetPitch = (game.seededRandom.next() * 2 - 1) * (STEVE_HEAD_MAX_PITCH * 0.75)
  game.entities2.setSteveHeadLook(self, targetYaw, targetPitch, game.currentTick)
}

export const push = (game: GameStateImplementation, self: EntityId): void => {
  snapCurrentFacing(game, self)
  game.entities2.setSteveAnimation(self, SteveAnimationId.Idle, game.currentTick)
  game.entities2.pushActivityFrame(self, ActivityId.Steve_Idle, undefined, computeNextIdleWakeTick(game))
}

export const perform = (game: GameStateImplementation, self: EntityId, _state: undefined): void => {
  snapCurrentFacing(game, self)

  const actionRoll = game.seededRandom.nextInt(100)
  if (actionRoll < IDLE_WALK_CHANCE) {
    if (SteveWalk.tryPush(game, self)) return

    const nextDirection = game.seededRandom.nextInt(8) as Direction
    game.entities2.setFacing(self, nextDirection)
    game.entities2.setSteveAnimation(self, SteveAnimationId.Idle, game.currentTick)
    game.entities2.setWakeTick(self, computeNextIdleWakeTick(game))
    return
  }

  if (actionRoll < IDLE_WALK_CHANCE + IDLE_WAVE_HAND_CHANCE) {
    SteveWavingHand.push(game, self)
    return
  }

  pickIdleHeadLook(game, self)
  game.entities2.setWakeTick(self, computeNextIdleWakeTick(game))
}

export const onChildFinished = (
  game: GameStateImplementation,
  self: EntityId,
  _state: undefined,
  _child: CompletedChild,
): void => {
  snapCurrentFacing(game, self)
  game.entities2.setSteveAnimation(self, SteveAnimationId.Idle, game.currentTick)
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

    case InterruptionType.MoveToPosition: {
      const { x, z } = game.entities2.getPosition(self)!
      const deltaX = Math.sign(interruption.targetX - x)
      const deltaZ = Math.sign(interruption.targetZ - z)
      if (deltaX !== 0 || deltaZ !== 0) {
        const direction = getRotationByChangeInCoords(deltaX, deltaZ)
        const distance = Math.max(Math.abs(interruption.targetX - x), Math.abs(interruption.targetZ - z))
        SteveWalk.tryPush(game, self, direction, distance)
      }
      return InterruptionResolution.Handled
    }

    case InterruptionType.Startle:
    case InterruptionType.Attacked:
      SteveWalk.tryPush(game, self)
      return InterruptionResolution.Handled

    default:
      return InterruptionResolution.Handled
  }
}
