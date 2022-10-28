import { COMMIT_HASH } from "../../util/build-info"
import CONFIG from "../../util/persistance/observable-settings"
import { constant, map, observeField, Subject } from "../../util/state/subject"
import { newStatsObject, StatFields } from "../../util/worker/debug-stats/render"
import animatedVisibility from "../preferences/animated-visibility"
import { createElement } from "../utils"

import './style.css'

export default (parent: HTMLElement) => {
    const visible = observeField(CONFIG, 'other/show-debug-info')
    const [root] = animatedVisibility(createElement('div', parent, '_css_debug-info'), visible, [])

    KeyValueText(root, `Next wonder`, constant(`#${COMMIT_HASH}`))

    const stats = newStatsObject()

    KeyValueText(root, `Renderer`, observeField(stats, StatFields.RendererName))
    KeyValueText(root, `Draw calls`, map(observeField(stats, StatFields.DrawCallsCount), e => `${e}`))



    return {
        updateValues(values: any) {
            stats.replaceFromArray(values)
        }
    }
}

const KeyValueText = (div: HTMLElement, keyText: string, value: Subject<string>) => {
    const p = createElement('p', div, '_css_key_value_p')
    const keySpan = createElement('span', p,)
    const valueSpan = createElement('span', p,)
    keySpan['textContent'] = keyText
    value.on(value => valueSpan['textContent'] = value)
}