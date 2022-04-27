import {
	CreateGameArguments,
	Environment,
	EnvironmentConnection,
	getSuggestedEnvironmentName,
	loadEnvironment,
	SaveMethod,
} from './environments/loader'
import { ScheduledActionId } from './game-state/scheduled-actions'
import { ActionsQueue } from './game-state/scheduled-actions/queue'
import { StateUpdater } from './game-state/state-updater'
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
	actionsQueue: ActionsQueue | null
}

const state: PageState = {
	updater: null,
	environment: null,
	actionsQueue: null,
}

let pauseOnBlur = false
observeSetting('other/pause-on-blur', v => pauseOnBlur = v)
window.addEventListener('blur', () => pauseOnBlur && state?.updater?.stop())
window.addEventListener('focus', () => pauseOnBlur && state?.updater?.start(SettingsContainer.INSTANCE.get('other/tps') as number))

observeSetting('other/tps', tps => state?.updater?.changeTickRate(tps))
observeSetting('rendering/antialias', () => setTimeout(() => state?.environment?.startRender({canvas: recreateCanvas()}), 10))

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
	const url = data.url
	const anchor = document.createElement('a')
	anchor['href'] = url
	anchor['download'] = 'latest.map-save.json'
	anchor['click']()
	URL.revokeObjectURL(url)
}

window.addEventListener('beforeunload', async () => {
	state.environment?.saveGame({saveName: 'latest', method: SaveMethod.ToIndexedDatabase})
})

document.getElementById('input-reset-normal')!
	.addEventListener('click', async (event) => {
		SettingsContainer.INSTANCE.set('other/generate-debug-world', false);
		(event.target as HTMLElement)['blur']()
		await runGame({})
	})


document.getElementById('input-reset-to-debug')!
	.addEventListener('click', async (event) => {
		SettingsContainer.INSTANCE.set('other/generate-debug-world', true);
		(event.target as HTMLElement)['blur']()
		await runGame({})
	})

document.addEventListener('keydown', async event => {
	if (event['code'] === 'KeyS' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		state.environment?.saveGame({saveName: 'latest', method: SaveMethod.ToDataUrl})
	} else if (event['code'] === 'KeyO' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		const file = await askForFile()
		if (file != null) {
			await runGame({fileToRead: file})
		}
	} else if (event['code'] === 'KeyD' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		state?.actionsQueue?.append({type: ScheduledActionId.DebugCreateBuildingPrototype})
	}
})


const prepareEnvironment = (): Promise<EnvironmentConnection> => {
	const preferredEnvironment = SettingsContainer.INSTANCE.get('other/preferred-environment') as Environment
	return loadEnvironment(getSuggestedEnvironmentName(preferredEnvironment), saveCallback)
}

const runGame = async (args: CreateGameArguments) => {
	if (state.environment === null) return
	await state.environment.terminateGame({})
	const results = await state.environment.createNewGame(args)
	await state.environment.startRender({canvas: recreateCanvas()})
	state.updater = results.updater
	state.actionsQueue = results.queue
	const speedToSet = +SettingsContainer.INSTANCE.get('other/tps')
	state.updater.start(speedToSet)
}

const initPageState = async () => {
	state.environment = await prepareEnvironment()

	const anySaveName = await getSavesList().then(e => e[0])
	await runGame({saveName: anySaveName})
}
// noinspection JSIgnoredPromiseFromCall
initPageState()
