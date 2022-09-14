import KeyboardController from '../../util/keyboard-controller'
import { constant, Subject } from '../../util/state/subject'
import { Callback, createElement } from '../utils'
import AnimatedVisibility from './animated-visibility'
import BuildInfoSection from './build-info-section'
import { Button } from './helper-components'
import OnBlurBehaviourSection from './on-blur-section'
import RenderingSection from './rendering-section'

export default (parent: HTMLElement, opened: Subject<boolean>, doneClicked: Callback) => {
	opened.on(opened => {
		KeyboardController.INSTANCE?.setMaskEnabled(opened)
	})

	const [root] = AnimatedVisibility(createElement('div', parent, 'settings'), opened, ['opacity', 'translate-y'])

	Header(root, constant('Game preferences'), false)
	RenderingSection(root)
	OnBlurBehaviourSection(root)
	BuildInfoSection(root)

	Footer(root, doneClicked)
}

export const Header = (root: HTMLElement, title: Subject<string>, subHeader: boolean) => {
	const header = createElement('header', root, subHeader ? 'sub-header' : '')
	const p = createElement('p', header)
	title.on(title => p['innerText'] = title)
}

const Footer = (root: HTMLElement, doneClicked: () => void) => {
	const footer = createElement('footer', root)
	Button(footer, constant('Done'), doneClicked)
}
