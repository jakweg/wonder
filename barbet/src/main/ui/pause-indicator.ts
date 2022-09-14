import { Subject } from '../util/state/subject'
import AnimatedVisibility from './preferences/animated-visibility'
import { createElement } from './utils'

export default (root: HTMLElement, isPaused: Subject<boolean>) => {
	const [indicator] = AnimatedVisibility(createElement('div', root, 'pause-indicator'), isPaused, ['opacity'])
	indicator['innerText'] = 'Game is paused'
}
