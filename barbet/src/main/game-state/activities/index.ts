import * as slime_idle from './slime/idle'
import * as slime_jump from './slime/jump'
import * as slime_slowRotate from './slime/slow-rotate'

export const enum ActivityId {
  None,

  Slime_Idle,
  Slime_SlowRotate,
  Slime_Jump,
}

export const getActivityPerformFunction = (id: ActivityId) => {
  switch (id) {
    case ActivityId.Slime_Idle:
      return slime_idle.perform
    case ActivityId.Slime_SlowRotate:
      return slime_slowRotate.perform
    case ActivityId.Slime_Jump:
      return slime_jump.perform

    default:
      return null
  }
}
