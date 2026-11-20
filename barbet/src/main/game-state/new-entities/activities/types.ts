import type { ActivityId } from '@game/new-entities/activities'

export const enum InterruptionResolution {
  /** Interruption was handled by this activity; runner consumes it from InterruptionsStore */
  Handled = 0,
  /** Keep interruption queued in InterruptionsStore until the current top-of-stack activity finishes */
  Defer = 1,
  /** Abort & pop this child activity (invoking onAbort) and pass the same interruption to its parent */
  AbortAndPassToParent = 2,
}

/**
 * Maps parameterized ActivityIds to their child -> parent completion result types.
 * Activities omitted from this interface default to `null`.
 */
export interface ActivityResultById {
  [ActivityId.Slime_Idle]: unknown
  [ActivityId.Slime_Jump]: number
}

export type ActivityResult<Id extends ActivityId> = Id extends keyof ActivityResultById ? ActivityResultById[Id] : null

export type CompletedChild<Id extends ActivityId = ActivityId> = {
  [K in Id]: {
    readonly finishedActivityId: K
    readonly result: ActivityResult<K>
  }
}[Id]
