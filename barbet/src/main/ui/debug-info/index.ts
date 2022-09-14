import { COMMIT_HASH } from "../../util/build-info"
import CONFIG from "../../util/persistance/observable-settings"
import { constant, observeField, Subject } from "../../util/state/subject"
import animatedVisibility from "../preferences/animated-visibility"
import { createElement } from "../utils"

export default (parent: HTMLElement) => {
    const visible = observeField(CONFIG, 'other/show-debug-info')
    const [root] = animatedVisibility(createElement('div', parent, 'debug-info'), visible, [])

    DebugText(root, constant(`Next wonder #${COMMIT_HASH}`))
}

const DebugText = (div: HTMLElement, text: Subject<string>) => {
    const p = createElement('p', div,)
    text.on(text => p['innerText'] = text)
}