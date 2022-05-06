import CONFIG from '../../util/persistance/observable-settings'
import { constantState, map, Observable, observeField } from '../../util/state/observable'
import { Callback, createElement } from '../utils'

export default (parent: HTMLElement, opened: Observable<boolean>, doneClicked: Callback) => {
	const overlay = createElement('div', parent, 'settings-overlay')
	const root = createElement('div', parent, 'settings')

	opened(opened => {
		root['classList']['toggle']('opened', opened)
		overlay['classList']['toggle']('visible', opened)
	})

	Header(root, constantState('Game preferences'))
	Main(root)

	Footer(root, doneClicked)
}

const Header = (root: HTMLElement, title: Observable<string>) => {
	const header = createElement('header', root)
	const p = createElement('p', header)
	title(title => p['innerText'] = title)
}

const Footer = (root: HTMLElement, doneClicked: () => void) => {
	const footer = createElement('footer', root)
	Button(footer, constantState('Done'), doneClicked)
}

const Main = (root: HTMLElement) => {
	const main = createElement('main', root)

	BooleanSwitch(main, 'rendering/antialias', (v: boolean) => `Antialiasing: ${v ? 'ON' : 'OFF'}`)
	BooleanSwitch(main, 'rendering/show-tile-borders', (v: boolean) => `Tile borders: ${v ? 'ON' : 'OFF'}`)
	BooleanSwitch(main, 'other/pause-on-blur', (v: boolean) => `Auto pause: ${v ? 'ON' : 'OFF'}`)
}

const BooleanSwitch = (main: HTMLElement,
                       key: Parameters<typeof CONFIG.get>[0],
                       titleFunction: (v: boolean) => string) => {
	const onClick = () => CONFIG.set(key, !CONFIG.get(key))
	Button(main, map(observeField(CONFIG, key), titleFunction), onClick)
}

const Button = (root: HTMLElement,
                       displayedText: Observable<string>,
                       onClick: Callback) => {
	const container = createElement('button', root, 'setting-button') as HTMLButtonElement
	container['type'] = 'button'
	container.addEventListener('click', onClick)

	displayedText(displayedText => container.innerText = displayedText)
}
