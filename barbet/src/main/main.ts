import { StateUpdater } from './3d-stuff/game-state/state-updater'
import { Environment, loadEnvironment } from './environments/loader'
import {
	bindFrontendVariablesToCanvas,
	initFrontendVariableAndRegisterToWindow,
} from './util/frontend-variables-updaters'
import { getSavesList } from './util/persistance/saves-database'
import { sharedMemoryIsAvailable } from './util/shared-memory'
import SettingsContainer, { observeSetting } from './worker/observable-settings'
import { addSaveCallback, registerSaveSettingsCallback } from './worker/serializable-settings'

SettingsContainer.INSTANCE = SettingsContainer.fromLocalstorage()
addSaveCallback(() => SettingsContainer.INSTANCE.saveToLocalStorage())
registerSaveSettingsCallback()
initFrontendVariableAndRegisterToWindow()

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement

bindFrontendVariablesToCanvas(canvas)

let updater: StateUpdater | null = null

let pauseOnBlur = false
observeSetting('other/pause-on-blur', v => pauseOnBlur = v)
window.addEventListener('blur', () => pauseOnBlur && updater?.stop())
window.addEventListener('focus', () => pauseOnBlur && updater?.start())

const ticksInput = document.getElementById('input-ticksPerSecond') as HTMLInputElement
let speedToSet = 0
observeSetting('other/tps', (value) => speedToSet = Math.max(1, +value))

ticksInput['value'] = speedToSet.toString()
ticksInput.addEventListener('input', async (event) => {
	speedToSet = +(event['target'] as HTMLInputElement)['value']
	updater?.changeTickRate(speedToSet)
	SettingsContainer.INSTANCE.set('other/tps', speedToSet)
})


const fpsCapInput = document.getElementById('input-fpsCap') as HTMLInputElement
observeSetting('rendering/fps-cap', (value) => fpsCapInput['value'] = (value || 0)?.toString())
fpsCapInput.addEventListener('input', async (event) => {
	const value = +(event['target'] as HTMLInputElement)['value']
	SettingsContainer.INSTANCE.set('rendering/fps-cap', value)
});

(async () => {
	const anySaveName = getSavesList().then(e => e[0])

	let usedEnvironment: Environment = 'zero'
	if (sharedMemoryIsAvailable) {
		const offscreenCanvasIsAvailable = !!((window as any).OffscreenCanvas)
		if (offscreenCanvasIsAvailable)
			usedEnvironment = 'second'
		else {
			usedEnvironment = 'first'
		}
	}

	const env = await loadEnvironment(usedEnvironment)
	const game = await env['createNewGame']({'saveName': await anySaveName})
	const receivedUpdater = game['updater']
	await env['startRender']({'canvas': canvas, 'game': game['state'], 'updater': receivedUpdater})
	receivedUpdater.start(speedToSet)
	updater = receivedUpdater

	window.addEventListener('beforeunload', async () => {
		env['saveGame']({'saveName': 'latest'})
	})
})()
