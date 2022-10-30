import { KeyValueText, TimesTable } from "."
import { map, observeField } from "../../util/state/subject"
import { REQUESTED_MEASUREMENTS } from "../../util/worker/debug-stats/draw-phase"
import { newStatsObject, StatField } from "../../util/worker/debug-stats/update"
import { UpdatePhase } from "../../util/worker/debug-stats/update-phase"

export default (root: HTMLElement) => {

    const stats = newStatsObject()

    KeyValueText(root, `Loading world`, map(observeField(stats, StatField.GameLoadTimeMs), e => `${e.toFixed(1)}ms`))

    const names = [
        'LockMutex',
        'ScheduledActions',
        'EntityActivities',
        'ActionsQueue',
        'DelayedComputer',
    ]

    TimesTable(root, 'Update phase',
        'UPS',
        REQUESTED_MEASUREMENTS,
        names,
        UpdatePhase.SIZE,
        () => new Float32Array(stats.get(StatField.UpdateTimesDetailed)))


    return stats
}