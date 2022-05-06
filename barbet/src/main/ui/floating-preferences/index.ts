import CONFIG from '../../util/persistance/observable-settings'
import { Observable, observeField } from '../../util/state/observable'
import { RestartIcon, SettingsIcon, TpsIcon } from '../icons'
import { Callback, createElement } from '../utils'


export default (parent: HTMLElement, openSettingsClicked: Callback) => {
	const root = createElement('div', parent, 'floating-preferences')

	TpsIcon(root)

	RangeInput(root, observeField(CONFIG, 'other/tps'), v => CONFIG.set('other/tps', v))

	ButtonsBar(root, openSettingsClicked)
}

const RangeInput = (parent: HTMLElement,
                    value: Observable<number>,
                    valueChanged: (value: number) => void) => {
	const input = createElement('input', parent, 'tps-selector') as HTMLInputElement
	input['type'] = 'range'
	input['min'] = '1'
	input['max'] = '200'
	input['step'] = '1'
	input['title'] = 'Speed of the simulation'

	value(value => input['value'] = `${value}`)

	input.addEventListener('input', (event) => {
		const value = +(event['target'] as HTMLInputElement)['value']
		valueChanged(value)
	})
}

const ButtonWithIcon = (parent: HTMLElement,
                        title: string,
                        icon: typeof RestartIcon,
                        onClick: Callback) => {
	const btn = createElement('button', parent) as HTMLButtonElement
	btn['type'] = 'button'
	btn['title'] = title

	icon(btn)

	btn.addEventListener('click', onClick)
}


const ButtonsBar = (parent: HTMLElement, openSettingsClicked: Callback) => {
	const bar = createElement('div', parent, 'buttons')

	ButtonWithIcon(bar, 'Restart', RestartIcon, () => console.log('clicked'))
	ButtonWithIcon(bar, 'Settings', SettingsIcon, openSettingsClicked)
}
