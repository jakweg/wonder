import { bindFrontendVariablesToCanvas } from '../util/frontend-variables-updaters'
import { createElement } from './utils'

export default (parent: HTMLElement) => {
  let element = createElement('canvas', parent) as HTMLCanvasElement
  let cancelListenersCallback = bindFrontendVariablesToCanvas(element)
  return {
    recreate(): HTMLCanvasElement {
      cancelListenersCallback()
      const newElement = document['createElement']('canvas') as HTMLCanvasElement
      newElement['width'] = 0
      newElement['height'] = 0
      let triesCounter = 0
      const old = element
      const intervalId = setInterval(() => {
        if (newElement['width'] !== 0 || triesCounter++ > 100) {
          clearInterval(intervalId)
          old['classList']['add']('_css_fade-out')
          setTimeout(() => {
            old['remove']()
          }, 1500)
        }
      }, 50)
      parent['insertBefore'](newElement, element)
      element = newElement
      cancelListenersCallback = bindFrontendVariablesToCanvas(newElement)
      return newElement
    },
  }
}
