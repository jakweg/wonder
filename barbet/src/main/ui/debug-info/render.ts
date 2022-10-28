import { KeyValueText } from "."
import { observeField, map } from "../../util/state/subject"
import { newStatsObject, StatField } from "../../util/worker/debug-stats/render"

export default (root: HTMLElement) => {

    const stats = newStatsObject()

    KeyValueText(root, `Renderer`, observeField(stats, StatField.RendererName))
    KeyValueText(root, `Draw calls`, map(observeField(stats, StatField.DrawCallsCount), e => `${e}`))

    return stats
}