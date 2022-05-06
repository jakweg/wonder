import { bindFrontendVariablesToCanvas } from '../util/frontend-variables-updaters'
import { constantState, Observable } from '../util/state/observable'
import { createElement } from './'

export const createUi = (parent: HTMLElement) => {
	const root = createElement('div', parent, 'root')

	const canvas = CanvasBackground(root)
	SettingsElement(root, constantState(false))

	return {
		canvas,
	}
}

const CanvasBackground = (parent: HTMLElement) => {
	let element = createElement('canvas', parent) as HTMLCanvasElement
	let cancelListenersCallback = bindFrontendVariablesToCanvas(element)
	return {
		recreate(): HTMLCanvasElement {
			cancelListenersCallback()
			const newElement = document.createElement('canvas') as HTMLCanvasElement
			parent['replaceChild'](newElement, element)
			element = newElement
			cancelListenersCallback = bindFrontendVariablesToCanvas(newElement)
			return newElement
		},
	}
}

const SettingsElement = (parent: HTMLElement, opened: Observable<boolean>) => {
	const root = createElement('div', parent, 'settings')
}
