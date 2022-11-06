import { map, observeField } from '@utils/state/subject'
import { REQUESTED_MEASUREMENTS } from '@utils/worker/debug-stats/requsted-measurements'
import { newStatsObject, StatField } from '@utils/worker/debug-stats/update'
import { UpdatePhase } from '@utils/worker/debug-stats/update-phase'
import { KeyValueText, TimesTable } from '.'

export default (root: HTMLElement) => {
  const stats = newStatsObject()

  KeyValueText(
    root,
    `Loading world`,
    map(observeField(stats, StatField.GameLoadTimeMs), e => `${e.toFixed(1)}ms`),
  )

  const names = ['LockMutex', 'ScheduledActions', 'EntityActivities', 'ActionsQueue', 'DelayedComputer']

  TimesTable(
    root,
    'Update phase',
    'UPS',
    REQUESTED_MEASUREMENTS,
    names,
    UpdatePhase.SIZE,
    () => new Float32Array(stats.get(StatField.UpdateTimesDetailed)),
  )

  return stats
}
