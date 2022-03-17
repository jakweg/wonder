import { StateUpdater } from './3d-stuff/game-state/state-updater'
import { Environment, loadEnvironment, SaveMethod } from './environments/loader'
import {
	bindFrontendVariablesToCanvas,
	initFrontendVariableAndRegisterToWindow,
} from './util/frontend-variables-updaters'
import { deleteAllSaves, getSavesList } from './util/persistance/saves-database'
import { sharedMemoryIsAvailable } from './util/shared-memory'
import SettingsContainer, { observeSetting } from './worker/observable-settings'
import { addSaveCallback, registerSaveSettingsCallback } from './worker/serializable-settings'

SettingsContainer.INSTANCE = SettingsContainer.fromLocalstorage()
addSaveCallback(() => SettingsContainer.INSTANCE.saveToLocalStorage())
registerSaveSettingsCallback()
initFrontendVariableAndRegisterToWindow()

const recreateCanvas = (): HTMLCanvasElement => {
	const canvas = document.getElementById('main-canvas') as HTMLCanvasElement
	(canvas as any)['cancelCallback']?.()

	const clone = canvas['cloneNode'](false) as HTMLCanvasElement
	canvas['parentElement']!['replaceChild'](clone, canvas);

	(clone as any)['cancelCallback'] = bindFrontendVariablesToCanvas(clone)
	return clone
}

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
})

let deletedAll: boolean = false
document.getElementById('input-reset')!.addEventListener('click', async () => {
	deletedAll = true
	await deleteAllSaves()
})

const askForFile = async () => {
	return new Promise<File | null>(resolve => {
		const input = document.createElement('input')
		input['type'] = 'file'
		input['accept'] = '.json'
		input['oninput'] = () => {
			const selectedFile = input['files']?.[0]
			if (selectedFile == null) {
				resolve(null)
				return
			}
			resolve(selectedFile)
		}
		input['click']()
	})
}

const saveCallback = (data: any) => {
	const url = data['url']
	const anchor = document.createElement('a')
	anchor['href'] = url
	anchor['download'] = 'latest.map-save.json'
	anchor['click']()
	URL.revokeObjectURL(url)
}

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

	const env = await loadEnvironment(usedEnvironment, saveCallback)
	const game = await env['createNewGame']({'saveName': await anySaveName})
	const receivedUpdater = game['updater']
	await env['startRender']({'canvas': recreateCanvas()})
	receivedUpdater.start(speedToSet)
	updater = receivedUpdater

	window.addEventListener('beforeunload', async () => {
		if (!deletedAll)
			env['saveGame']({'saveName': 'latest', 'method': SaveMethod.ToIndexedDatabase})
	})

	document.addEventListener('keydown', async event => {
		if (event['code'] === 'KeyS' && event['ctrlKey']) {
			event.preventDefault()
			event.stopPropagation()
			env['saveGame']({'saveName': 'latest', 'method': SaveMethod.ToDataUrl})
		}
		if (event['code'] === 'KeyT') {
			env['terminateGame']({})
		} else if (event['code'] === 'KeyO' && event['ctrlKey']) {
			event.preventDefault()
			event.stopPropagation()
			const file = await askForFile()
			if (file != null) {
				await env['terminateGame']({})
				const results = await env['createNewGame']({'fileToRead': file})
				await env['startRender']({'canvas': recreateCanvas()})
				results['updater'].start(speedToSet)
			}
		}
	})
})()
