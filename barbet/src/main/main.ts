import { STANDARD_GAME_TICK_RATE, StateUpdater } from './3d-stuff/game-state/state-updater'
import { Environment, loadEnvironment } from './environments/loader'
import { bindFrontendVariablesToCanvas, initFrontendVariableAndRegisterToWindow } from './util/frontend-variables'
import { sharedMemoryIsAvailable } from './util/shared-memory'
import SettingsContainer, { observeSetting } from './worker/observable-settings'
import { addSaveCallback, getFromLocalStorage, registerSaveSettingsCallback } from './worker/serializable-settings'

SettingsContainer.INSTANCE = SettingsContainer.fromLocalstorage()
addSaveCallback(() => SettingsContainer.INSTANCE.saveToLocalStorage())
registerSaveSettingsCallback()
initFrontendVariableAndRegisterToWindow()

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement

bindFrontendVariablesToCanvas(canvas)

let updater: StateUpdater | null = null

if (getFromLocalStorage('other/pause-on-blur') === true) {
	window.addEventListener('blur', () => updater?.stop())
	window.addEventListener('focus', () => updater?.start())
}

const ticksInput = document.getElementById('input-ticksPerSecond') as HTMLInputElement
let speedToSet = 0
observeSetting('other/tps', STANDARD_GAME_TICK_RATE, (value) => speedToSet = Math.max(1, +value))

ticksInput.value = speedToSet.toString()
ticksInput.addEventListener('input', async (event) => {
	speedToSet = +(event.target as HTMLInputElement).value
	updater?.changeTickRate(speedToSet)
	SettingsContainer.INSTANCE.set('other/tps', speedToSet)
})


const fpsCapInput = document.getElementById('input-fpsCap') as HTMLInputElement
observeSetting('rendering/fps-cap', 0, (value) => fpsCapInput.value = (value || 0)?.toString())
fpsCapInput.addEventListener('input', async (event) => {
	const value = +(event.target as HTMLInputElement).value
	SettingsContainer.INSTANCE.set('rendering/fps-cap', value)
});

(async () => {
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
	const game = await env.createNewGame()
	await env.startRender({canvas, game: game.state, updater: game.updater})
	game.updater.start(speedToSet)
	updater = game.updater
})()
