import { StateUpdater } from './3d-stuff/game-state/state-updater'
import {
	CreateGameArguments,
	EnvironmentConnection,
	getSuggestedEnvironmentName,
	loadEnvironment,
	SaveMethod,
} from './environments/loader'
import { bindSettingsListeners } from './html-controls/settings'
import {
	bindFrontendVariablesToCanvas,
	initFrontendVariableAndRegisterToWindow,
} from './util/frontend-variables-updaters'
import { getSavesList } from './util/persistance/saves-database'
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


interface PageState {
	updater: StateUpdater | null
	environment: EnvironmentConnection | null
}

const state: PageState = {
	updater: null,
	environment: null,
}

let pauseOnBlur = false
observeSetting('other/pause-on-blur', v => pauseOnBlur = v)
window.addEventListener('blur', () => pauseOnBlur && state?.updater?.stop())
window.addEventListener('focus', () => pauseOnBlur && state?.updater?.start())

observeSetting('other/tps', tps => state?.updater?.changeTickRate(tps))
observeSetting('rendering/antialias', () => setTimeout(() => state?.environment?.['startRender']({'canvas': recreateCanvas()}), 100))

bindSettingsListeners()
document['body'].classList['remove']('not-loaded-body')


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

window.addEventListener('beforeunload', async () => {
	state.environment?.['saveGame']({'saveName': 'latest', 'method': SaveMethod.ToIndexedDatabase})
})

const inputReset = document.getElementById('input-reset')!
inputReset.addEventListener('click', async () => {
	inputReset['blur']()
	await runGame({})
})

document.addEventListener('keydown', async event => {
	if (event['code'] === 'KeyS' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		state.environment?.['saveGame']({'saveName': 'latest', 'method': SaveMethod.ToDataUrl})
	} else if (event['code'] === 'KeyO' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		const file = await askForFile()
		if (file != null) {
			await runGame({'fileToRead': file})
		}
	} else if (event['code'] === 'KeyD' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		state?.environment?.['debugCommand']({type: 'create-building-prototype'})
	}
})


const prepareEnvironment = (): Promise<EnvironmentConnection> => {
	return loadEnvironment(getSuggestedEnvironmentName(), saveCallback)
}

const runGame = async (args: CreateGameArguments) => {
	if (state.environment === null) return
	await state.environment['terminateGame']({})
	const results = await state.environment['createNewGame'](args)
	await state.environment['startRender']({'canvas': recreateCanvas()})
	state.updater = results['updater']
	const speedToSet = +SettingsContainer.INSTANCE.get('other/tps')
	state.updater.start(speedToSet)
}

const initPageState = async () => {
	state.environment = await prepareEnvironment()

	const anySaveName = await getSavesList().then(e => e[0])
	await runGame({'saveName': anySaveName})
}
// noinspection JSIgnoredPromiseFromCall
initPageState()
