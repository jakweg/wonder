import { CreateGameResult, Environment, EnvironmentConnection, GameListeners, getSuggestedEnvironmentName, loadEnvironment } from '../entry-points/feature-environments/loader'
import { Status } from '../game-state/state-updater'
import { SaveMethod } from '../game-state/world/world-saver'
import { ConnectionStatus, initialState } from '../network2/initialState'
import { TickQueueAction, TickQueueActionType } from '../network2/tick-queue-action'
import CONFIG from '../util/persistance/observable-settings'
import State from '../util/state'
import { globalMutex } from '../util/worker/global-mutex'
import { spawnNew } from '../util/worker/message-types/network2'

export type Operation = { type: 'start', tps: number }

interface CreateGameArguments {
	canvasProvider: () => HTMLCanvasElement
}

const TICKS_BUFFER_SIZE = 3

class ActionsBroadcastHelper {
	private eventsToSend: { tick: number, action: TickQueueAction }[] = []
	private lastExecutedTick: number = 0
	private lastSendTick: number = 0

	constructor(
		private readonly onSend: (tick: number, actions: TickQueueAction[]) => void
	) { }

	public enqueueAction(action: TickQueueAction): void {
		this.eventsToSend.push({ tick: this.lastExecutedTick + TICKS_BUFFER_SIZE + 1, action })
	}

	public initializeFromTick(tick: number): void {
		this.eventsToSend.splice(0)
		this.lastExecutedTick = this.lastSendTick = tick
	}

	public tickDone(tick: number): void {
		this.lastExecutedTick = tick
		this.checkIfNeedsToSend()
	}

	public checkIfNeedsToSend(): void {
		const difference = this.lastSendTick - this.lastExecutedTick
		if (difference >= TICKS_BUFFER_SIZE)
			return

		const needsSendCount = TICKS_BUFFER_SIZE - difference
		for (let i = 1; i <= needsSendCount; i++) {
			const tick = this.lastSendTick + i
			const actionsForThisTick: TickQueueAction[] = []
			while (this.eventsToSend.length > 0) {
				const action = this.eventsToSend[0]!
				if (action.tick !== tick) break
				this.eventsToSend.shift()
				actionsForThisTick.push(action.action)
			}

			this.onSend(tick, actionsForThisTick)
		}
		this.lastSendTick += needsSendCount
	}
}

export class RemoteSession {
	private state = State.fromInitial(initialState)
	private actionsHelper = new ActionsBroadcastHelper(this.broadcastMyActions.bind(this))
	private currentGame: CreateGameResult | null = null

	private constructor(
		private readonly ws: Awaited<ReturnType<typeof spawnNew>>,
		private readonly environment: EnvironmentConnection,
	) {
		ws.receive.on('state-update', data => this.state.update(data))
		ws.receive.on('got-player-actions', ({ tick, from, actions }) => {
			this.currentGame?.setActionsCallback(tick, from, actions)
		})
	}

	public static async createNew() {
		const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
		const env = await loadEnvironment(suggestedName)
		return new RemoteSession(await spawnNew(globalMutex), env)
	}

	getState() {
		return this.state
	}

	async connect(to: string): Promise<void> {
		const connectionStatus = this.state.get('connection-status')
		if (connectionStatus !== ConnectionStatus.Disconnected && connectionStatus !== ConnectionStatus.Error)
			throw new Error('Already connected')


		this.ws.send.send('connect', { address: to })

		if (!(await this.ws.receive.await('connection-made')).success)
			throw new Error('failed to establish connection')
	}
	async joinRoom(id: string): Promise<void> {
		if (this.state.get('connection-status') !== ConnectionStatus.Connected)
			throw new Error('not connected')

		this.ws.send.send('join-room', { roomId: id })

		if (!(await this.ws.receive.await('joined-room')).ok)
			throw new Error('failed to join room')
	}
	private gameListener: GameListeners = {
		onInputCaused: (action) => {
			this.actionsHelper.enqueueAction({
				type: TickQueueActionType.GameAction,
				action: action,
				initiatorId: 0,
			})
		},
		onTickCompleted: (tick) => {
			this.actionsHelper.tickDone(tick)
		},
	}
	async createNewGame(args: CreateGameArguments): Promise<void> {
		if (this.currentGame !== null) throw new Error('already loaded')
		const result = this.currentGame = await this.environment.createNewGame({})
		this.actionsHelper.initializeFromTick(result.updater.getExecutedTicksCount())
		const self = this
		result.setGameListeners(this.gameListener)

		await this.environment.startRender({ canvas: args.canvasProvider() })
	}
	async waitForGameFromNetwork(canvasProvider: () => HTMLCanvasElement): Promise<void> {
		const { serializedState } = await this.ws.receive.await('got-game-state')
		const result = this.currentGame = await this.environment.createNewGame({ stringToRead: serializedState })
		result.setGameListeners(this.gameListener)

		await this.environment.startRender({ canvas: canvasProvider() })
	}
	async lockRoom(lock: boolean) {
		if (this.state.get('connection-status') !== ConnectionStatus.Connected)
			throw new Error('not connected')
		this.ws.send.send('set-prevent-joins', { prevent: !!lock })
	}
	async broadcastGameToOthers() {
		const result = await this.environment.saveGame({ method: SaveMethod.ToString2 })
		if (result.method !== SaveMethod.ToString2) throw new Error()
		this.ws.send.send('broadcast-game-state', { serializedState: result.serializedState })
	}
	resume(tps: number) {
		if (!this.currentGame) throw new Error('no game')
		if (this.currentGame.updater.getCurrentStatus() !== Status.Stopped) return

		this.broadcastOperation({ type: 'start', tps })

	}
	async listenForOperations() {
		while (this.state.get('connection-status') === ConnectionStatus.Connected) {
			const operation = await this.ws.receive.await('got-operation')

			switch (operation.type) {
				case 'start':
					if (!this.currentGame) throw new Error('no game')
					const playerIds = Object.keys(this.state.get('players-in-room') ?? {})
					this.currentGame.setPlayerIdsCallback(playerIds)

					const ticksCount = this.currentGame.updater.getExecutedTicksCount()
					this.actionsHelper.tickDone(ticksCount)

					this.currentGame.updater.start(operation.tps)
					break
			}
		}
	}
	terminate(): void {
		this.ws.terminate()
		this.environment.terminate({ terminateEverything: true })
	}
	private broadcastOperation(operation: Operation): void {
		this.ws.send.send('broadcast-operation', operation)
	}

	private broadcastMyActions(tick: number, actions: TickQueueAction[]): void {
		this.ws.send.send('broadcast-my-actions', { tick, actions })
	}
}

// interface Props {
// 	remoteUrl: string
// 	roomId: string
// 	canvasProvider: () => HTMLCanvasElement
// 	feedbackHandler: (event: FeedbackEvent) => void
// }

// export const createRemoteSession = async (props: Props): Promise<any> => {
// 	const { initialState } = await import('../network2/initialState')
// 	const { send, receive, terminate: terminateWorker } = await spawnNew(globalMutex)

// 	receive.on('connection-dropped', () => console.info('Connection closed'))

// 	const networkState = State.fromInitial(initialState)
// 	receive.on('state-update', data => networkState.update(data))

// 	send.send('connect', { address: props.remoteUrl });
// 	if (!(await receive.await('connection-made')).success)
// 		throw new Error('failed to establish connection')

// 	console.log('connected to server successfully');

// 	send.send('join-room', { roomId: props.roomId })
// 	if (!(await receive.await('joined-room')).ok)
// 		throw new Error('failed to join room')

// 	const getMyRole = () => networkState.get('players-in-room')?.[networkState.get('my-id') ?? '']?.role


// 	const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
// 	const environment = await loadEnvironment(suggestedName, props.feedbackHandler)
// 	let currentGame: Awaited<ReturnType<typeof environment.createNewGame>> | null = null

// 	return {
// 		networkState,
// 		async setRoomLocked(locked: boolean) {
// 			if (getMyRole() !== PlayerRole.Owner)
// 				throw new Error()

// 			send.send('set-prevent-joins', { prevent: true })
// 			while (true) {
// 				if (networkState.get('room-is-locked'))
// 					break

// 				await sleep(200)
// 			}
// 		},
// 		async createGame(args: CreateGameArguments): Promise<void> {
// 			if (getMyRole() !== PlayerRole.Owner)
// 				throw new Error()

// 			currentGame = await environment.createNewGame(args)
// 		},
// 		terminate(): void {
// 			terminateWorker()
// 			environment.terminate({ terminateEverything: true })
// 		}
// 	}


// }
