import { GameStateImplementation } from '@game'
import {
  ActivityId,
  getActivityOnAbort,
  getActivityOnChildFinished,
  getActivityOnInterruption,
  getActivityPerform,
} from '@game/new-entities/activities'
import { ActivityResult, CompletedChild, InterruptionResolution } from '@game/new-entities/activities/types'
import EntityId from '@game/new-entities/id'
import { SLEEP_INDEFINITELY } from '@game/new-entities/stores/activity'

/**
 * Delivers the entity's pending interruption to its top activity frame, unwinding via `onAbort` on `AbortAndPassToParent`.
 */
export const deliverPendingInterruption = (
  game: GameStateImplementation,
  entityId: EntityId,
): InterruptionResolution => {
  if (!game.entities2.isEntityAlive(entityId)) {
    game.entities2.consumePendingInterruption(entityId)
    return InterruptionResolution.Handled
  }

  const interruption = game.entities2.getPendingInterruption(entityId)
  if (!interruption) return InterruptionResolution.Handled

  while (true) {
    const topFrame = game.entities2.getTopActivityFrame(entityId)
    if (!topFrame) {
      game.entities2.consumePendingInterruption(entityId)
      return InterruptionResolution.Handled
    }

    const resolution = getActivityOnInterruption(topFrame.activityId)(game, entityId, topFrame.state, interruption)

    switch (resolution) {
      case InterruptionResolution.Handled:
        game.entities2.consumePendingInterruption(entityId)
        return InterruptionResolution.Handled

      case InterruptionResolution.Defer:
        game.entities2.markInterruptionDeferred(entityId)
        return InterruptionResolution.Defer

      case InterruptionResolution.AbortAndPassToParent:
        getActivityOnAbort(topFrame.activityId)(game, entityId, topFrame.state)
        game.entities2.popActivityFrame(entityId)
        // will do the frames loop again
        break
    }
  }
}

/**
 * Completes the currently running `activityId` frame, pops it, and (unless preempted by a pending interruption)
 * synchronously invokes the parent frame's `onChildFinished` on the same tick.
 */
export const finishActivity = <Id extends ActivityId>(
  game: GameStateImplementation,
  entityId: EntityId,
  finishedActivityId: Id,
  result: ActivityResult<Id>,
): void => {
  const topFrame = game.entities2.getTopActivityFrame(entityId)
  if (!topFrame || topFrame.activityId !== finishedActivityId) {
    throw new Error(
      `finishActivity expected top frame ${finishedActivityId}, got ${topFrame?.activityId ?? 'empty stack'}`,
    )
  }

  game.entities2.popActivityFrame(entityId)

  const parentFrame = game.entities2.getTopActivityFrame(entityId)
  if (!parentFrame) {
    game.entities2.consumePendingInterruption(entityId)
    // TODO possibly handle running out of frames
    return
  }

  if (game.entities2.getPendingInterruption(entityId) !== undefined) {
    const resolution = deliverPendingInterruption(game, entityId)
    const parentStillOnTop = game.entities2.getTopActivityFrame(entityId) === parentFrame
    // Only proceed to parent.onChildFinished if the parent deferred the interruption
    // without pushing a prerequisite child frame (e.g. StandUp) or popping itself.
    if (resolution !== InterruptionResolution.Defer || !parentStillOnTop) {
      return
    }
  }

  getActivityOnChildFinished(parentFrame.activityId)(game, entityId, parentFrame.state, {
    finishedActivityId,
    result,
  } as CompletedChild)
}

export interface EntityActivitiesRunner {
  advanceActivities(game: GameStateImplementation): void
}

export const createEntityActivitiesRunner = (): EntityActivitiesRunner => {
  let scratchEntityIds = new Uint32Array(64)

  const drainInterruptions = (game: GameStateImplementation): void => {
    while (true) {
      const count = game.entities2.drainNewlyInterruptedEntityIds(scratchEntityIds)
      if (count === 0) break
      if (count === -1) {
        scratchEntityIds = new Uint32Array(scratchEntityIds.length * 2)
        continue
      }

      for (let i = 0; i < count; ++i) {
        const entityId = scratchEntityIds[i]! as unknown as EntityId
        deliverPendingInterruption(game, entityId)
      }
    }
  }

  return {
    advanceActivities(game: GameStateImplementation): void {
      const currentTick = game.currentTick >>> 0

      drainInterruptions(game)

      let dueCount = game.entities2.fillDueActivityEntityIds(currentTick, scratchEntityIds)
      while (dueCount === -1) {
        scratchEntityIds = new Uint32Array(scratchEntityIds.length * 2)
        dueCount = game.entities2.fillDueActivityEntityIds(currentTick, scratchEntityIds)
      }

      for (let i = 0; i < dueCount; ++i) {
        const entityId = scratchEntityIds[i]! as unknown as EntityId
        if (!game.entities2.isEntityAlive(entityId)) continue
        if (game.entities2.getWakeTick(entityId) > currentTick) continue

        const topFrame = game.entities2.getTopActivityFrame(entityId)
        if (!topFrame) continue

        game.entities2.setWakeTick(entityId, SLEEP_INDEFINITELY)
        getActivityPerform(topFrame.activityId)(game, entityId, topFrame.state)
      }

      // Flush any interruptions emitted by activities during the due-timer pass on the same tick
      drainInterruptions(game)
    },
  }
}
