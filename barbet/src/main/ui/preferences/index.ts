import { Observable } from '../../util/state/observable'
import { createElement } from '../utils'

export default (parent: HTMLElement, opened: Observable<boolean>) => {
	const overlay = createElement('div', parent, 'settings-overlay')
	const root = createElement('div', parent, 'settings')

	root.innerText = 'Settings'
	opened(opened => {
		root['classList']['toggle']('opened', opened)
		overlay['classList']['toggle']('visible', opened)
	})
}
