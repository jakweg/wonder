import CONFIG from '../../util/persistance/observable-settings'
import { map, observeField, Subject } from '../../util/state/subject'
import { Callback, createElement } from '../utils'

export const BooleanSwitch = (main: HTMLElement,
	key: Parameters<typeof CONFIG.get>[0],
	titleFunction: (v: boolean) => string) => {
	const onClick = () => CONFIG.set(key, !CONFIG.get(key))
	Button(main, map(observeField(CONFIG, key), titleFunction), onClick)
}

export const Button = (root: HTMLElement,
	displayedText: Subject<string>,
	onClick: Callback) => {
	const container = createElement('button', root, '_css_setting-button') as HTMLButtonElement
	container['type'] = 'button'
	container.addEventListener('click', onClick)

	displayedText.on(displayedText => container['innerText'] = displayedText)
}

export const Range = (root: HTMLElement,
	displayedText: Subject<string>,
	range: [number, number],
	step: number,
	value: Subject<number>,
	setValue: (value: number) => void) => {
	const container = createElement('div', root, '_css_setting-range') as HTMLDivElement
	const movingPart = createElement('div', container, '_css_moving-part') as HTMLDivElement
	const title = createElement('div', container, '_css_title') as HTMLDivElement

	const stepsCount = (range[1] - range[0]) / step

	const handleDragMove = (event: PointerEvent) => {
		let progress = event['offsetX'] / (event['target'] as HTMLDivElement)['clientWidth']
		if (progress < 0)
			progress = 0
		else if (progress > 1)
			progress = 1
		progress = Math.round(progress * stepsCount) / stepsCount
		setValue(Math.round((progress * (range[1] - range[0]) + range[0])))
	}

	value.on(value => {
		const progress = (value - range[0]) / (range[1] - range[0])
		movingPart['style']['setProperty']('--_css_progress', `${Math.round(progress * 100) | 0}%`)
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
	}, { 'passive': true })

	displayedText.on(displayedText => title['innerText'] = displayedText)
}
