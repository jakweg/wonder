import { bindFrontendVariablesToCanvas } from '../util/frontend-variables-updaters'
import { createElement } from './utils'

export default (parent: HTMLElement) => {
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
