import CONFIG, { observeSetting } from '../util/persistance/observable-settings'

function antiAlias() {
	const input = document.getElementById('input-enable-antialias') as HTMLSelectElement
	observeSetting('rendering/antialias', (value) => input['value'] = value ? '1' : '0')
	input.addEventListener('change', () => {
		input.disabled = true
		CONFIG.set('rendering/antialias', input['value'] === '1')
		setTimeout(() => input.disabled = false, 500)
	})
}

function tileBorders() {
	const input = document.getElementById('input-enable-tile-borders') as HTMLSelectElement
	observeSetting('rendering/show-tile-borders', (value) => input['value'] = value ? '1' : '0')
	input.addEventListener('change', () => {
		CONFIG.set('rendering/show-tile-borders', input['value'] === '1')
	})
}

function pauseOnBlur() {
	const input = document.getElementById('input-pause-on-blur') as HTMLSelectElement
	observeSetting('other/pause-on-blur', (value) => input['value'] = value ? '1' : '0')
	input.addEventListener('change', () => {
		CONFIG.set('other/pause-on-blur', input['value'] === '1')
	})
}

function fpsCap() {
	const input = document.getElementById('input-fps-cap') as HTMLSelectElement
	observeSetting('rendering/fps-cap', (value) => input['value'] = `${value}`)
	input.addEventListener('change', () => {
		CONFIG.set('rendering/fps-cap', +input['value'])
	})
}


function fpsCapOnBlur() {
	const input = document.getElementById('input-fps-cap-blur') as HTMLSelectElement
	observeSetting('rendering/fps-cap-on-blur', (value) => input['value'] = `${value}`)
	input.addEventListener('change', () => {
		CONFIG.set('rendering/fps-cap-on-blur', +input['value'])
	})
}

function closeAndOpenButton() {
	const settingsElement = document.getElementById('settings')!
	const overlay = document.getElementById('overlay')!
	document.getElementById('btn-close-settings')?.addEventListener('click', () => {
		settingsElement.classList['toggle']('shown')
		overlay.classList['toggle']('shown');
		(document['activeElement'] as any)['blur']()
	})
	document.getElementById('input-settings')?.addEventListener('click', () => {
		settingsElement.classList['toggle']('shown')
		overlay.classList['toggle']('shown');
		(document['activeElement'] as any)['blur']()
	})
}


function tps() {
	const input = document.getElementById('input-ticksPerSecond') as HTMLSelectElement
	observeSetting('other/tps', (value) => input['value'] = `${value}`)
	input.addEventListener('change', () => {
		CONFIG.set('other/tps', +input['value'])
	})
}

function workers() {
	const input = document.getElementById('input-multithreading') as HTMLSelectElement
	observeSetting('other/preferred-environment', (value) => {
		switch (value) {
			case 'zero':
				input['value'] = `none`
				break
			case 'first':
				input['value'] = `off-update`
				break
			default:
			case 'second':
				input['value'] = `off-update-and-render`
				break
		}
	})
	input.addEventListener('change', () => {
		let valueToSet
		switch (input['value']) {
			case 'off-update-and-render':
				valueToSet = 'second'
				break
			case 'off-update':
				valueToSet = 'first'
				break
			default:
			case 'none':
				valueToSet = 'zero'
				break
		}
		CONFIG.set('other/preferred-environment', valueToSet)
	})
}

export const bindSettingsListeners = () => {
	tps()

	antiAlias()
	tileBorders()
	pauseOnBlur()
	fpsCap()
	fpsCapOnBlur()
	workers()

	closeAndOpenButton()
}
