import { FrontendVariable } from '@utils/frontend-variables'
import { bindFrontendVariablesToCanvas } from '@utils/frontend-variables-updaters'
import { createNewBuffer } from '@utils/shared-memory'
import { createElement } from './utils'

export interface UICanvas {
  element: HTMLCanvasElement
  frontendVariables: Int32Array
}

export default (parent: HTMLElement) => {
  let element = createElement('canvas', parent) as HTMLCanvasElement
  let cancelListenersCallback = () => {}
  let frontendVariables = new Int32Array(createNewBuffer(Int32Array.BYTES_PER_ELEMENT * FrontendVariable.SIZE))
  return {
    getFrontendVariables() {
      return frontendVariables
    },
    recreate(): UICanvas {
      const oldCancelListenersCallback = cancelListenersCallback
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
            oldCancelListenersCallback()
            old['remove']()
          }, 1500)
        }
      }, 50)
      parent['insertBefore'](newElement, element)
      element = newElement

      const returnedValue = {
        element: newElement,
        frontendVariables: new Int32Array(createNewBuffer(Int32Array.BYTES_PER_ELEMENT * FrontendVariable.SIZE)),
      } satisfies UICanvas
      frontendVariables = returnedValue.frontendVariables

      cancelListenersCallback = bindFrontendVariablesToCanvas(returnedValue)
      return returnedValue
    },
  }
}
