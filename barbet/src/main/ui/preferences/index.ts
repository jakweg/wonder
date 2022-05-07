import { constantState, Observable } from '../../util/state/observable'
import { Callback, createElement } from '../utils'
import AnimatedVisibility from './animated-visibility'
import BuildInfoSection from './build-info-section'
import { Button } from './helper-components'
import OnBlurBehaviourSection from './on-blur-section'
import RenderingSection from './rendering-section'

export default (parent: HTMLElement, opened: Observable<boolean>, doneClicked: Callback) => {
	const overlay = AnimatedVisibility(createElement('div', parent, 'settings-overlay'), opened, ['opacity'])
	overlay.addEventListener('click', doneClicked)

	const root = AnimatedVisibility(createElement('div', parent, 'settings'), opened, ['opacity', 'translate-y'])

	Header(root, constantState('Game preferences'), false)
	RenderingSection(root)
	OnBlurBehaviourSection(root)
	BuildInfoSection(root)

	Footer(root, doneClicked)
}

export const Header = (root: HTMLElement, title: Observable<string>, subHeader: boolean) => {
	const header = createElement('header', root, subHeader ? 'sub-header' : '')
	const p = createElement('p', header)
	title(title => p['innerText'] = title)
}

const Footer = (root: HTMLElement, doneClicked: () => void) => {
	const footer = createElement('footer', root)
	Button(footer, constantState('Done'), doneClicked)
}
