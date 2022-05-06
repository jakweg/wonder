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
	FpsCapSetting(main)
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

const FpsCapSetting = (main: HTMLElement) => {
	const fpsCap = observeField(CONFIG, 'rendering/fps-cap')
	const mapTitle = (v: number) => `Max framerate: ${v === 0 ? 'VSYNC' : v}`
	Range(main, map(fpsCap, mapTitle), [0, 60], 5, fpsCap, (value) => CONFIG.set('rendering/fps-cap', value))
}

const Range = (root: HTMLElement,
               displayedText: Observable<string>,
               range: [number, number],
               step: number,
               value: Observable<number>,
               setValue: (value: number) => void) => {
	const container = createElement('div', root, 'setting-range') as HTMLDivElement
	const movingPart = createElement('div', container, 'moving-part') as HTMLDivElement
	const title = createElement('div', container, 'title') as HTMLDivElement

	const stepsCount = (range[1] - range[0]) / step

	const handleDragMove = (event: PointerEvent) => {
		let progress = event.offsetX / (event.target as HTMLDivElement).clientWidth
		if (progress < 0)
			progress = 0
		else if (progress > 1)
			progress = 1
		progress = Math.round(progress * stepsCount) / stepsCount
		setValue(Math.round((progress * (range[1] - range[0]) + range[0])))
	}

	value(value => {
		const progress = (value - range[0]) / (range[1] - range[0])
		movingPart['style']['setProperty']('--progress', `${Math.round(progress * 100) | 0}%`)
	})

	let dragging = false
	container.addEventListener('pointerdown', event => {
		dragging = true
		handleDragMove(event)
	})
	container.addEventListener('pointerup', event => {
		if (!dragging) return
		dragging = false
		handleDragMove(event)
	})
	container.addEventListener('pointerleave', event => {
		if (!dragging) return
		dragging = false
		handleDragMove(event)
	})
	container.addEventListener('pointermove', event => {
		if (dragging) handleDragMove(event)
	}, {'passive': true})

	displayedText(displayedText => title.innerText = displayedText)
}
