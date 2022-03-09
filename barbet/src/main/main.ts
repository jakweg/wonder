import { StateUpdater } from './3d-stuff/game-state/state-updater'
import { Environment, loadEnvironment } from './environments/loader'
import { bindFrontendVariablesToCanvas, initFrontendVariableAndRegisterToWindow } from './util/frontend-variables'
import { sharedMemoryIsAvailable } from './util/shared-memory'
import { registerSaveSettingsCallback } from './worker/serializable-settings'

registerSaveSettingsCallback()
initFrontendVariableAndRegisterToWindow()

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement

bindFrontendVariablesToCanvas(canvas)

let updater: StateUpdater | null = null
const ticksInput = document.getElementById('input-ticksPerSecond') as HTMLInputElement
let speedToSet = +ticksInput.value
ticksInput.addEventListener('input', async (event) => {
	speedToSet = +(event.target as HTMLInputElement).value
	updater?.changeTickRate(speedToSet)
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
