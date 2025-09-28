import CONFIG from '@utils/persistence/observable-settings'
import { constant, map, observeField } from '@utils/state/subject'
import { createElement } from '../utils'
import { BooleanSwitch, Range } from './helper-components'
import { Header } from './index'

export default (root: HTMLElement) => {
  Header(root, constant('Behaviour after focus loss'), true)
  const main = createElement('main', root)

  BooleanSwitch(main, 'other/pause-on-blur', (v: boolean) => `Auto pause: ${v ? 'ON' : 'OFF'}`)
  FpsCapOnBlurSetting(main)
}

const FpsCapOnBlurSetting = (main: HTMLElement) => {
  const fpsCap = observeField(CONFIG, 'rendering/fps-cap-on-blur')
  const values = [0, 1, 2, 5, 10, 15, 30, 60, 1000]
  const mapTitle = (v: number) => `${v === 0 ? 'Pause rendering' : v === 1000 ? 'No limit' : `Limit framerate: ${v}`}`
  const mapValue = (v: number) => (values.indexOf(v) + 1 || 1) - 1

  Range(main, map(fpsCap, mapTitle), [0, values.length - 1], 1, map(fpsCap, mapValue), value =>
    CONFIG.set('rendering/fps-cap-on-blur', values[value] ?? 0),
  )
}
