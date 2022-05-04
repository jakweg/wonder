import { createLocalSession, createRemoteSession, GameSession } from '../game-session/'
import { bindSettingsListeners } from '../html-controls/settings'
import { DEFAULT_NETWORK_SERVER_ADDRESS } from '../util/build-info'
import {
	bindFrontendVariablesToCanvas,
	initFrontendVariableAndRegisterToWindow,
} from '../util/frontend-variables-updaters'
import CONFIG, {
	initSettingsFromLocalStorage,
	observeSetting,
	saveSettingsToLocalStorage,
} from '../util/persistance/observable-settings'
import { addSaveCallback, registerSaveSettingsCallback } from '../util/persistance/serializable-settings'
import { FeedbackEvent } from './feature-environments/loader'

initSettingsFromLocalStorage()
addSaveCallback(() => saveSettingsToLocalStorage())
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
// window.addEventListener('blur', () => pauseOnBlur && session?.invokeUpdaterAction({type: 'pause'}))
// window.addEventListener('focus', () => pauseOnBlur && session?.invokeUpdaterAction({
// 	type: 'resume',
// 	tickRate: CONFIG.get('other/tps') as number,
// }))

// observeSetting('other/tps', tps => session?.invokeUpdaterAction({
// 	type: 'change-tick-rate',
// 	tickRate: tps,
// }))

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
		session?.terminate()
		session = null
		CONFIG.set('other/generate-debug-world', false);
		(event.target as HTMLElement)['blur']()
		// TODO: restart game
	})


document.getElementById('input-reset-to-debug')!
	.addEventListener('click', async (event) => {
		CONFIG.set('other/generate-debug-world', true);
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


const feedbackFinalHandler = async (event: FeedbackEvent) => {
	switch (event.type) {
		case 'saved-to-url':
			downloadSaveToDeviceStorage(event.url)
			break
		case 'error':
			session?.terminate()
			session = null
			break
		case 'became-leader':
			setTimeout(() => {
				console.log('i am a leader now')
				session?.dispatchAction({
					type: 'create-game',
					args: {}, // it'll generate new world
				})
			}, 0)
			break
		default:
			console.warn('Unknown feedback', event.type)
			break
	}
}

const startRemoteSession = async (url: string) => {
	session = await createRemoteSession({
		feedbackCallback: feedbackFinalHandler,
		remoteUrl: url,
		canvasProvider: recreateCanvas,
	})
}

const startLocalSession = async () => {
	session = await createLocalSession({
		canvasProvider: recreateCanvas,
		feedbackCallback: feedbackFinalHandler,
	})
	session.dispatchAction({
		type: 'create-game',
		args: {},
	})
}

const initPageState = async () => {
	if (DEFAULT_NETWORK_SERVER_ADDRESS !== undefined)
		await startRemoteSession(DEFAULT_NETWORK_SERVER_ADDRESS)
	else
		await startLocalSession()
}

initPageState().then(() => void 0)
