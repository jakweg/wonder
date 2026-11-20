import { GameStateImplementation } from '@game'
import { CompletedChild, InterruptionResolution } from '@game/new-entities/activities/types'
import EntityId from '@game/new-entities/id'
import { Interruption } from '@game/new-entities/stores/interruptions'

export const perform = (_game: GameStateImplementation, _self: EntityId, _state: any): void => void 0

export const onChildFinished = (
  _game: GameStateImplementation,
  _self: EntityId,
  _state: any,
  _child: CompletedChild,
): void => void 0

export const onAbort = (_game: GameStateImplementation, _self: EntityId, _state: any): void => void 0

export const onInterruptionDefer = (
  _game: GameStateImplementation,
  _self: EntityId,
  _state: any,
  _interruption: Interruption,
): InterruptionResolution => InterruptionResolution.Defer

export const onInterruptionPassToParent = (
  _game: GameStateImplementation,
  _self: EntityId,
  _state: any,
  _interruption: Interruption,
): InterruptionResolution => InterruptionResolution.AbortAndPassToParent
