import CONFIG from '@utils/persistence/observable-settings'
import { constant, map, observeField } from '@utils/state/subject'
import { Header } from '.'
import { createElement } from '../utils'
import { BooleanSwitch, Range } from './helper-components'

export default (root: HTMLElement) => {
  Header(root, constant('Developer'), true)
  const main = createElement('main', root)

  BooleanSwitch(main, 'debug/debug-world', v => `Debug world: ${v ? 'ON' : 'OFF'}`)
  BooleanSwitch(main, 'debug/disable-culling', v => `Culling: ${v ? 'OFF' : 'ON'}`)
  BooleanSwitch(main, 'debug/show-info', v => `Floating info: ${v ? 'ON' : 'OFF'}`)
  BooleanSwitch(main, 'debug/show-graphs', v => `Graphs: ${v ? 'ON' : 'OFF'}`)
  TerrainMultiplierSetting(main)
  MultiplayerLatency(main)
}

const TerrainMultiplierSetting = (main: HTMLElement) => {
  const value = observeField(CONFIG, 'rendering/terrain-height')
  const mapTitle = (v: number) => `Terrain height: ${v.toFixed(2)}`
  const mapValue = (v: number) => (v * 100) | 0
  Range(main, map(value, mapTitle), [0, 200], 1, map(value, mapValue), value =>
    CONFIG.set('rendering/terrain-height', value / 100),
  )
}

const MultiplayerLatency = (main: HTMLElement) => {
  const value = observeField(CONFIG, 'multiplayer/latency')
  const mapTitle = (v: number) => `Expected latency: ${v}ms.`
  Range(
    main,
    map(value, mapTitle),
    [20, 800],
    10,
    map(value, (v: number) => v | 0),
    value => CONFIG.set('multiplayer/latency', value),
  )
}
