import { can, MemberPermissions } from '../../../../seampan/room-snapshot'
import { sleep } from '../../../../seampan/util'
import { RemoteSession } from '../game-session/remote2'
import { GameSession } from '../game-session/session'
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

// observeSetting('rendering/antialias', () => setTimeout(() => session?.resetRendering(), 10))

const waitForOtherPlayers = async (
	state: State<typeof initialState>,
	minCount: number) => {
	while (Object.keys(state.get('players-in-room') ?? {}).length < minCount)
		await sleep(50)
}

const initPageState = async () => {
	const remote = session = await RemoteSession.createNew()

	await remote.connect('localhost:3719')

	await remote.joinRoom('default')

	await waitForOtherPlayers(remote.getState(), 1)

	const myRole = (remote.getState().get('players-in-room') ?? {})[remote.getState().get('my-id') ?? '']?.role
	if (can(myRole, MemberPermissions.SendGameState)) {
		console.info('I\'m the owner, waiting for other players')

		await remote.createNewGame({
			canvasProvider: uiHandlers.canvas.recreate
		})

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

		await remote.waitForGameFromNetwork(uiHandlers.canvas.recreate)
		remote.listenForOperations()

	}




	// // if (DEFAULT_NETWORK_SERVER_ADDRESS !== undefined)
	// // 	await startRemoteSession(DEFAULT_NETWORK_SERVER_ADDRESS)
	// // else
	// // await startLocalSession()
	// // if (Math.random() < 100)
	// // 	return


	// const network2 = await import('../util/worker/message-types/network2')
	// const { initialState } = await import('../network2/initialState')
	// const { send, receive } = await network2.spawnNew(globalMutex)

	// receive.on('connection-dropped', () => console.info('Connection closed'))

	// const networkState = State.fromInitial(initialState)
	// networkState.observeEverything(console.log)
	// receive.on('state-update', data => networkState.update(data))

	// send.send('connect', { address: 'localhost:3719' });
	// if (!(await receive.await('connection-made')).success) {
	// 	console.error('failed to establish connection');
	// 	return
	// }
	// console.log('connected to server successfully');


	// send.send('join-room', { roomId: 'abcd' })
	// if (!(await receive.await('joined-room')).ok) {
	// 	console.error('failed to join room');
	// 	return
	// }
	// console.log('Joined room', networkState.get('room-id'));

	// const MIN_PLAYERS = 2

	// while (true) {
	// 	const playersCount = Object.keys(networkState.get('players-in-room') ?? {}).length
	// 	if (playersCount >= MIN_PLAYERS)
	// 		break

	// 	await sleep(200)
	// }


	// const session = await createGenericSession({
	// 	canvasProvider: uiHandlers.canvas.recreate,
	// 	ticksToTakeActionProvider: () => 15,
	// 	myPlayerId: () => 1,
	// 	sendActionsToWorld(tick, actions) {
	// 		console.log('send');
	// 		console.log({ tick, actions });
	// 		send.send('broadcast-my-actions', { tick, actions })

	// 		// throw new Error('not implemented: sendActionsToWorld')
	// 	},
	// 	dispatchUpdaterAction(action) {
	// 		throw new Error('not implemented: dispatchUpdaterAction')
	// 	},
	// 	handleFeedbackCallback(event) {
	// 		throw new Error('not implemented: handleFeedbackCallback')
	// 	},
	// 	async onGameLoaded(actionsCallback, setIds) {
	// 		console.log('loaded');

	// 		const players = networkState.get('players-in-room') ?? {}
	// 		const myRole = players[networkState.get('my-id') ?? '']?.role

	// 		if (myRole === PlayerRole.Owner) {
	// 			const saveResult = await session.getEnvironment().saveGame({ method: SaveMethod.ToString2, })
	// 			if (saveResult.method !== SaveMethod.ToString2) return

	// 			console.log('broadcasting game');
	// 			send.send('broadcast-game-state', { serializedState: saveResult.serializedState })
	// 		}

	// 		const ids = Object.keys(players)
	// 		setIds(ids)
	// 	},
	// 	onPauseRequested() {
	// 		throw new Error('not implemented: onPauseRequested')
	// 	},
	// 	onResumeRequested() {
	// 		throw new Error('not implemented: onResumeRequested')
	// 	},
	// })

	// const myRole = networkState.get('players-in-room')?.[networkState.get('my-id') ?? '']?.role
	// if (myRole === PlayerRole.Owner) {
	// 	console.log('locking room')

	// 	send.send('set-prevent-joins', { prevent: true })
	// 	while (true) {
	// 		if (networkState.get('room-is-locked'))
	// 			break

	// 		await sleep(200)
	// 	}

	// 	console.log('Loading game');

	// 	session.dispatchAction({
	// 		type: 'create-game',
	// 		args: { gameSpeed: 0 },
	// 	})

	// 	// const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
	// 	// const environment = await loadEnvironment(suggestedName, feedbackFinalHandler)

	// 	// const game = await environment.createNewGame({})
	// 	// await environment.startRender({ canvas: uiHandlers.canvas.recreate() })
	// 	// const saveResult = await environment.saveGame({ method: SaveMethod.ToString2, })
	// 	// if (saveResult.method !== SaveMethod.ToString2) return

	// 	// console.log('broadcasting game');
	// 	// send.send('broadcast-game-state', { serializedState: saveResult.serializedState })


	// } else {
	// 	console.log('waiting for game to be broadcasted');
	// 	const { serializedState } = await receive.await('got-game-state')
	// 	console.log('got it');


	// 	session.dispatchAction({
	// 		type: 'create-game',
	// 		args: { stringToRead: serializedState, gameSpeed: 0 }
	// 	})


	// 	// const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
	// 	// const environment = await loadEnvironment(suggestedName, feedbackFinalHandler)

	// 	// const game = await environment.createNewGame({ stringToRead: serializedState })
	// 	// await environment.startRender({ canvas: uiHandlers.canvas.recreate() })

	// 	// console.log('Game ready to play!');

	// }




	// result.updater.start(20)
	// result.setActionsCallback(1, 0, [])

}

initPageState().then(() => void 0)


