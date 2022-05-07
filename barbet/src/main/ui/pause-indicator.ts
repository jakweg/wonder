import { Observable } from '../util/state/observable'
import AnimatedVisibility from './preferences/animated-visibility'
import { createElement } from './utils'

export default (root: HTMLElement, isPaused: Observable<boolean>) => {
	const indicator = AnimatedVisibility(createElement('div', root, 'pause-indicator'), isPaused, ['opacity'])
	indicator['innerText'] = 'Game is paused'
}
