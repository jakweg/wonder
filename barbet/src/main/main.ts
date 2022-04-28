import { DEFAULT_NETWORK_SERVER_ADDRESS } from './build-info'
import { FeedbackEvent } from './environments/loader'
import { createSession, GameSession } from './game-session'
import { bindSettingsListeners } from './html-controls/settings'
import {
	bindFrontendVariablesToCanvas,
	initFrontendVariableAndRegisterToWindow,
} from './util/frontend-variables-updaters'
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

let session: GameSession | null = null


let pauseOnBlur = false
observeSetting('other/pause-on-blur', v => pauseOnBlur = v)
window.addEventListener('blur', () => pauseOnBlur && session?.invokeUpdaterAction({type: 'pause'}))
window.addEventListener('focus', () => pauseOnBlur && session?.invokeUpdaterAction({
	type: 'resume',
	tickRate: SettingsContainer.INSTANCE.get('other/tps') as number,
}))

observeSetting('other/tps', tps => session?.invokeUpdaterAction({
	type: 'change-tick-rate',
	tickRate: tps,
}))

observeSetting('rendering/antialias', () => setTimeout(() => session?.resetRendering(), 10))

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

const downloadSaveToDeviceStorage = (url: string) => {
	const anchor = document.createElement('a')
	anchor['href'] = url
	anchor['download'] = 'latest.map-save.json'
	anchor['click']()
	URL.revokeObjectURL(url)
}

window.addEventListener('beforeunload', async () => {
	// TODO autosave?
	// state.environment?.saveGame({saveName: 'latest', method: SaveMethod.ToIndexedDatabase})
})

document.getElementById('input-reset-normal')!
	.addEventListener('click', async (event) => {
		SettingsContainer.INSTANCE.set('other/generate-debug-world', false);
		(event.target as HTMLElement)['blur']()
		// TODO: restart game
	})


document.getElementById('input-reset-to-debug')!
	.addEventListener('click', async (event) => {
		SettingsContainer.INSTANCE.set('other/generate-debug-world', true);
		(event.target as HTMLElement)['blur']()
		// TODO: restart game
	})

document.addEventListener('keydown', async event => {
	if (event['code'] === 'KeyS' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		// TODO save to file?
		// state.environment?.saveGame({saveName: 'latest', method: SaveMethod.ToDataUrl})
	} else if (event['code'] === 'KeyO' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		const file = await askForFile()
		if (file != null) {
			// TODO: restart game from file {fileToRead: file}
		}
	} else if (event['code'] === 'KeyD' && event['ctrlKey']) {
		event.preventDefault()
		event.stopPropagation()
		// TODO: invoke debug action
		// state?.actionsQueue?.append({type: ScheduledActionId.DebugCreateBuildingPrototype})
	}
})


const feedbackMiddleware = async (event: FeedbackEvent) => {
	switch (event.type) {
		case 'became-session-leader':
			// const anySaveName = await getSavesList().then(e => e[0])
			// session.provideStartGameArguments({saveName: anySaveName})
			session?.provideStartGameArguments({})
			break
		case 'waiting-reason-update':
			break
		case 'paused-status-changed':
			if (event.reason === 'initial-pause') {
				const tickRate = +SettingsContainer.INSTANCE.get('other/tps')
				session?.invokeUpdaterAction({type: 'resume', tickRate})
			}
			break
		case 'saved-to-url':
			downloadSaveToDeviceStorage(event.url)
			break
		default:
			console.warn('Unknown feedback')
			break
	}
}

const initPageState = async () => {
	session = await createSession({
		feedbackCallback: feedbackMiddleware,
		remoteUrl: DEFAULT_NETWORK_SERVER_ADDRESS ?? null,
		canvasProvider: () => recreateCanvas(),
	})
}

initPageState().then(() => void 0)
