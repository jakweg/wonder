import { Subject } from '../../util/state/subject'

const ANIMATION_DURATION = 300

type Style = 'opacity' | 'translate-y'

export default <T extends HTMLElement>(element: T,
	visible: Subject<boolean>,
	styles: Style[] = ['opacity', 'translate-y']): [T, () => void] => {
	element['classList']['add']('animated-visibility', ...styles)
	element['style']['setProperty']('--duration', `${ANIMATION_DURATION}ms`)
	let timeoutId = 0
	let frameId = 0
	const cancel = visible.on(visible => {
		clearTimeout(timeoutId)
		cancelAnimationFrame(frameId)
		if (visible) {
			if (element['classList']['contains']('gone')) {
				element['classList']['remove']('gone')
				frameId = requestAnimationFrame(() => {
					frameId = requestAnimationFrame(() => {
						element['classList']['remove']('invisible')
						timeoutId = setTimeout(() => element['classList']['add']('fully-visible'), ANIMATION_DURATION)
					})
				})
			} else {
				element['classList']['remove']('invisible')
				timeoutId = setTimeout(() => element['classList']['add']('fully-visible'), ANIMATION_DURATION)
			}
		} else {
			element['classList']['add']('invisible')
			element['classList']['remove']('fully-visible')
			timeoutId = setTimeout(() => element['classList']['add']('gone'), ANIMATION_DURATION)
		}
	})
	return [element, cancel]
}
