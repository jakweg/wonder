import { GameStateImplementation } from '@game'
import { ActivityId } from '@game/new-entities/activities'
import { finishActivity } from '@game/new-entities/activities/runner'
import { InterruptionResolution } from '@game/new-entities/activities/types'
import EntityId from '@game/new-entities/id'
import { Interruption, InterruptionType } from '@game/new-entities/stores/interruptions'
import { getSteveAnimationDuration, SteveAnimationId } from '@game/new-entities/stores/steve-animation'

export { onAbort, onChildFinished } from '@game/new-entities/activities/defaults'

export const push = (game: GameStateImplementation, self: EntityId): void => {
  const animationId =
    game.seededRandom.nextInt(2) === 0 ? SteveAnimationId.WavingHandRight : SteveAnimationId.WavingHandLeft
  const duration = getSteveAnimationDuration(animationId)
  game.entities2.setSteveAnimation(self, animationId, game.currentTick)
  game.entities2.pushActivityFrame(self, ActivityId.Steve_WavingHand, undefined, (game.currentTick + duration) >>> 0)
}

export const perform = (game: GameStateImplementation, self: EntityId, _state: undefined): void => {
  finishActivity(game, self, ActivityId.Steve_WavingHand, null)
}

export const onInterruption = (
  _game: GameStateImplementation,
  _self: EntityId,
  _state: undefined,
  interruption: Interruption,
): InterruptionResolution => {
  return interruption.type === InterruptionType.Die
    ? InterruptionResolution.AbortAndPassToParent
    : InterruptionResolution.Defer
}
