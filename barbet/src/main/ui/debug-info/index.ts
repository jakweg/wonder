import { COMMIT_HASH } from "../../util/build-info"
import CONFIG from "../../util/persistance/observable-settings"
import { constant, observeField, Subject } from "../../util/state/subject"
import animatedVisibility from "../preferences/animated-visibility"
import { createElement } from "../utils"
import Render from "./render"
import Update from "./update"

import './style.css'

export default (parent: HTMLElement) => {
    const visible = observeField(CONFIG, 'other/show-debug-info')
    const [root] = animatedVisibility(createElement('div', parent, '_css_debug-info _css_debug-info-gone'), visible, [])
    setTimeout(() => {
        root['classList']['remove']('_css_debug-info-gone')
    }, 500);

    KeyValueText(root, `Next wonder`, constant(`#${COMMIT_HASH}`))

    const renderStats = Render(root)
    const updateStats = Update(root)

    return {
        updateRenderValues(values: any) {
            renderStats.replaceFromArray(values)
        },
        updateUpdateValues(values: any) {
            updateStats.replaceFromArray(values)
        },
    }
}

export const KeyValueText = (div: HTMLElement, keyText: string, value: Subject<string>) => {
    const p = createElement('p', div, '_css_key_value_p')
    const keySpan = createElement('span', p,)
    const valueSpan = createElement('span', p,)
    keySpan['textContent'] = keyText
    value.on(value => valueSpan['textContent'] = value)
}