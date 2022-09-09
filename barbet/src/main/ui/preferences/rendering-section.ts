import { Environment } from '../../entry-points/feature-environments/loader'
import CONFIG from '../../util/persistance/observable-settings'
import { constantState, map, observeField } from '../../util/state/observable'
import { createElement } from '../utils'
import { Header } from './'
import { BooleanSwitch, Button, Range } from './helper-components'

export default (root: HTMLElement) => {
	Header(root, constantState('Video settings'), true)
	const main = createElement('main', root)

	BooleanSwitch(main, 'rendering/antialias', (v: boolean) => `Antialiasing: ${v ? 'ON' : 'OFF'}`)
	FpsCapSetting(main)
	BooleanSwitch(main, 'rendering/show-tile-borders', (v: boolean) => `Tile borders: ${v ? 'ON' : 'OFF'}`)
	BooleanSwitch(main, 'rendering/ambient-occlusion', (v: boolean) => `Ambient occlusion: ${v ? 'ON' : 'OFF'}`)
	PreferredEnvironment(main)
}

const FpsCapSetting = (main: HTMLElement) => {
	const fpsCap = observeField(CONFIG, 'rendering/fps-cap')
	const mapTitle = (v: number) => `Max framerate: ${v === 0 ? 'VSYNC' : v}`
	Range(main, map(fpsCap, mapTitle), [0, 60], 5, fpsCap, (value) => CONFIG.set('rendering/fps-cap', value))
}

const PreferredEnvironment = (main: HTMLElement) => {
	const key = 'other/preferred-environment'
	const setting = observeField(CONFIG, key)
	const titleMapFunction = (v: Environment) => 'Use workers: ' + (v === 'second' ? 'both' : (v === 'first' ? 'update only' : 'none'))
	Button(main, map(setting, titleMapFunction), () => {
		switch (CONFIG.get(key)) {
			case 'second':
				CONFIG.set(key, 'zero')
				break
			case 'first':
				CONFIG.set(key, 'second')
				break
			default:
				CONFIG.set(key, 'first')
				break
		}
	})
}
