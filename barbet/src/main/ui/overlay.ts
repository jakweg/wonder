import { map, reduce, Subject } from '@utils/state/subject'
import AnimatedVisibility from './preferences/animated-visibility'
import { Callback, createElement } from './utils'

export default (root: HTMLElement, entries: Subject<boolean>[], onClick: Callback) => {
  const total = reduce(entries, (v, a) => a + (v ? 1 : 0), 0)

  const visible = map(total, e => e > 0)

  const [overlay] = AnimatedVisibility(createElement('div', root, '_css_overlay'), visible, ['_css_opacity'])
  overlay['addEventListener']('click', onClick)
}
