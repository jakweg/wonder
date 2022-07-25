import { Operation } from '.'
import { can, MemberPermissions } from '../../../../seampan/room-snapshot'
import { Status } from '../game-state/state-updater'
import { SaveMethod } from '../game-state/world/world-saver'
import ActionsBroadcastHelper from '../network2/actions-broadcast-helper'
import { ConnectionStatus, initialState } from '../network2/initialState'
import State from '../util/state'
import { globalMutex } from '../util/worker/global-mutex'
import { spawnNew } from '../util/worker/message-types/network2'
import { createGenericSession } from './generic'

interface Props {
	canvasProvider: () => HTMLCanvasElement | undefined
}

export type RemoteSession = Awaited<ReturnType<typeof createRemoteSession>>

const loadWebsocket = async (holder: any) => {
	const state = State.fromInitial(initialState)
	const ws = await spawnNew(globalMutex)
	ws.receive.on('state-update', data => state.update(data))
	ws.receive.on('got-player-actions', ({ tick, from, actions }) => {
		holder.generic.forwardPlayerActions(tick, from, actions)
	})

	return { ws, state }
}

const loadGenericSession = async (props: Props, holder: any) => {
	const sendActionsCallback: ConstructorParameters<typeof ActionsBroadcastHelper>[0]
		= (tick, actions) => holder.ws.send.send('broadcast-my-actions', { tick, actions })

	const generic = await createGenericSession({
		canvasProvider: props.canvasProvider,
		sendActionsCallback,
	})

	return generic
}

export const createRemoteSession = async (props: Props) => {
	const holder: any = { ws: null, generic: null }
	const [{ ws, state }, generic] = await Promise.all([
		loadWebsocket(holder),
		loadGenericSession(props, holder)
	])
	holder.ws = ws
	holder.generic = generic


	state.observe('latency-ticks', ticks => generic.setLatencyTicks(ticks))


	const broadcastOperation = (operation: Operation): void => {
		ws.send.send('broadcast-operation', operation)
	}

	return {
		isMultiplayer: () => true,
		getState: () => state,
		async connect(to: string): Promise<void> {
			const connectionStatus = state.get('connection-status')
			if (connectionStatus !== ConnectionStatus.Disconnected && connectionStatus !== ConnectionStatus.Error)
				throw new Error('Already connected')


			ws.send.send('connect', { address: to })

			if (!(await ws.receive.await('connection-made')).success)
				throw new Error('failed to establish connection')
		},
		async joinRoom(id: string): Promise<void> {
			if (state.get('connection-status') !== ConnectionStatus.Connected)
				throw new Error('not connected')

			ws.send.send('join-room', { roomId: id })

			if (!(await ws.receive.await('joined-room')).ok)
				throw new Error('failed to join room')
		},
		async createNewGame(): Promise<void> {
			generic.createNewGame({})
		},
		async waitForGameFromNetwork(): Promise<void> {
			const { serializedState } = await ws.receive.await('got-game-state')
			generic.createNewGame({ stringToRead: serializedState })
		},
		async lockRoom(lock: boolean) {
			if (state.get('connection-status') !== ConnectionStatus.Connected)
				throw new Error('not connected')
			ws.send.send('set-prevent-joins', { prevent: !!lock })
		},
		async broadcastGameToOthers() {
			const result = await generic
				.getEnvironment()
				.saveGame({ method: SaveMethod.ToString2 })

			if (result.method !== SaveMethod.ToString2) throw new Error()
			ws.send.send('broadcast-game-state', { serializedState: result.serializedState })
		},
		resume(tps: number) {
			broadcastOperation({ type: 'start', tps })
		},
		pause(): boolean {
			const previousStatus = generic
				.getCurrentGame()
				?.updater
				.getCurrentStatus()

			broadcastOperation({ type: 'pause', })

			return previousStatus === Status.Running
		},
		setLatencyTicks(count: number) {
			ws.send.send('set-latency-ticks', { count })
		},
		async listenForOperations() {
			while (state.get('connection-status') === ConnectionStatus.Connected) {
				const operation = await ws.receive.await('got-operation')

				switch (operation.type) {
					case 'start':
						const playerIds = Object
							.entries(state.get('players-in-room') ?? {})
							.filter(p => can(p[1].role, MemberPermissions.SendInputActions))
							.map(e => e[0])

						generic.start(playerIds, operation.tps)
						break
					case 'pause':
						generic.stop()
						break
				}
			}
		},
		isPaused() {
			return !generic.isRunning()
		},
		resetRendering: generic.resetRendering,
		terminate(): void {
			ws.terminate()
			generic.terminate()
		}
	}
}