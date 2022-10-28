import { KeyValueText } from "."
import { map, observeField } from "../../util/state/subject"
import { newStatsObject, StatField } from "../../util/worker/debug-stats/update"

export default (root: HTMLElement) => {

    const stats = newStatsObject()

    KeyValueText(root, `Loading world`, map(observeField(stats, StatField.GameLoadTimeMs), e => `${e.toFixed(3)}ms`))

    return stats
}