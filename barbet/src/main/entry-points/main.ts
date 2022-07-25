import { can, MemberPermissions } from '../../../../seampan/room-snapshot'
import { sleep } from '../../../../seampan/util'
import { GameSession } from '../game-session'
import { createLocalSession } from '../game-session/local'
import { createRemoteSession } from '../game-session/remote2'
import { initialState } from '../network2/initialState'
import { createUi } from '../ui/root'
import { initFrontendVariableAndRegisterToWindow } from '../util/frontend-variables-updaters'
import CONFIG, {
	initSettingsFromLocalStorage,
	observeSetting,
	saveSettingsToLocalStorage
} from '../util/persistance/observable-settings'
import { addSaveCallback, registerSaveSettingsCallback } from '../util/persistance/serializable-settings'
import State from '../util/state'

initSettingsFromLocalStorage()
addSaveCallback(() => saveSettingsToLocalStorage())
registerSaveSettingsCallback()
initFrontendVariableAndRegisterToWindow()

document['body'].classList['remove']('not-loaded-body')

let session: GameSession | null = null
const uiHandlers = createUi({
	root: document['body'],
	isPaused(): boolean {
		return session?.isPaused() === true
	},
	onPauseRequested() {
		session?.pause()
	},
	onResumeRequested() {
		session?.resume(CONFIG.get('other/tps'))
	}
})


const setupAutopause = () => {
	let shouldPauseOnBlur = false
	observeSetting('other/pause-on-blur', v => shouldPauseOnBlur = v)
	let shouldResumeOnFocus = false
	window.addEventListener('blur', () => {
		shouldResumeOnFocus = shouldPauseOnBlur
			&& session?.isMultiplayer() === false
			&& session?.pause() === true
	})
	window.addEventListener('focus', () => {
		if (shouldResumeOnFocus && shouldPauseOnBlur && session?.isMultiplayer() === false)
			session?.resume(CONFIG.get('other/tps'))
	})
}
setupAutopause()

observeSetting('other/tps', tps => {
	if (session?.isPaused() === false)
		session.resume(tps)
})

observeSetting('rendering/antialias', () => setTimeout(() => session?.resetRendering(), 10))

const waitForOtherPlayers = async (
	state: State<typeof initialState>,
	minCount: number) => {
	while (Object.keys(state.get('players-in-room') ?? {}).length < minCount)
		await sleep(50)
}

const startRemote = async () => {
	const remote = session = await createRemoteSession({
		canvasProvider: uiHandlers.canvas.recreate
	})

	await remote.connect('localhost:3719')

	await remote.joinRoom('default')

	await waitForOtherPlayers(remote.getState(), 1)

	const myRole = (remote.getState().get('players-in-room') ?? {})[remote.getState().get('my-id') ?? '']?.role
	if (can(myRole, MemberPermissions.SendGameState)) {
		console.info('I\'m the owner, waiting for other players')

		await remote.createNewGame()

		await waitForOtherPlayers(remote.getState(), 2)
		await remote.lockRoom(true)

		await sleep(100)

		remote.broadcastGameToOthers()
		console.log('Game broadcasted');

		await sleep(1000)
		remote.listenForOperations()
		remote.resume(20)

	} else {
		console.info('I\'m not the owner, wait for map to be sent')

		await remote.waitForGameFromNetwork()
		remote.listenForOperations()

	}
}

const startLocal = async () => {
	const local = session = await createLocalSession({
		canvasProvider: uiHandlers.canvas.recreate
	})
	await local.createNewGame({})
	local.resume(20)
}

const initPageState = async () => {
	startRemote()
}

initPageState().then(() => void 0)


