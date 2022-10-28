import { KeyValueText } from "."
import { map, observeField } from "../../util/state/subject"
import { newStatsObject, StatField } from "../../util/worker/debug-stats/render"

export default (root: HTMLElement) => {

    const stats = newStatsObject()

    KeyValueText(root, `Renderer`, observeField(stats, StatField.RendererName))
    KeyValueText(root, `Visible chunks`, map(observeField(stats, StatField.VisibleChunksCount), e => `${e}`))
    KeyValueText(root, `Draw calls`, map(observeField(stats, StatField.DrawCallsCount), e => `${e}`))

    return stats
}