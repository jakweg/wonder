import { map, Observable, sum } from '../util/state/observable'
import AnimatedVisibility from './preferences/animated-visibility'
import { Callback, createElement } from './utils'

export default (root: HTMLElement,
                entries: Observable<boolean>[],
                onClick: Callback) => {
	const total = sum(entries.map(e => map(e, v => (v ? 1 : 0))))

	const visible = map(total, e => e > 0)

	const overlay = AnimatedVisibility(createElement('div', root, 'overlay'), visible, ['opacity'])
	overlay.addEventListener('click', onClick)
}
