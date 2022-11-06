import { Subject } from '@utils/state/subject'
import './animated-visibility.css'

const ANIMATION_DURATION = 300

type Style = '_css_opacity' | '_css_translate-y'

export default <T extends HTMLElement>(
  element: T,
  visible: Subject<boolean>,
  styles: Style[] = ['_css_opacity', '_css_translate-y'],
): [T, () => void] => {
  element['classList']['add']('_css_animated-visibility', ...styles)
  element['style']['setProperty']('--_css_duration', `${ANIMATION_DURATION}ms`)
  let timeoutId = 0
  let frameId = 0
  const cancel = visible.on(visible => {
    clearTimeout(timeoutId)
    cancelAnimationFrame(frameId)
    if (visible) {
      if (element['classList']['contains']('_css_gone')) {
        element['classList']['remove']('_css_gone')
        frameId = requestAnimationFrame(() => {
          frameId = requestAnimationFrame(() => {
            element['classList']['remove']('_css_invisible')
            timeoutId = setTimeout(() => element['classList']['add']('_css_fully-visible'), ANIMATION_DURATION)
          })
        })
      } else {
        element['classList']['remove']('_css_invisible')
        timeoutId = setTimeout(() => element['classList']['add']('_css_fully-visible'), ANIMATION_DURATION)
      }
    } else {
      element['classList']['add']('_css_invisible')
      element['classList']['remove']('_css_fully-visible')
      timeoutId = setTimeout(() => element['classList']['add']('_css_gone'), ANIMATION_DURATION)
    }
  })
  return [element, cancel]
}
