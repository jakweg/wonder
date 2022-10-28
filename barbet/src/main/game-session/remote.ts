import { can, MemberPermissions } from '@seampan/room-snapshot'
import { Operation } from '.'
import { CreateGameArguments } from '../entry-points/feature-environments/loader'
import { Status } from '../game-state/state-updater'
import { SaveMethod } from '../game-state/world/world-saver'
import ActionsBroadcastHelper from '../network/actions-broadcast-helper'
import { ConnectionStatus, defaults, NetworkStateField } from '../network/state'
import IndexedState from '../util/state/indexed-state'
import { FromWorker, spawnNew, ToWorker } from '../util/worker/message-types/network'
import { createGenericSession } from './generic'

interface Props {
	canvasProvider: () => HTMLCanvasElement | undefined
}

export type RemoteSession = Awaited<ReturnType<typeof createRemoteSession>>

const loadWebsocket = async (holder: any) => {
	const state = IndexedState.fromObject(defaults)
	const ws = await spawnNew()
	ws.receive.on(FromWorker.StateUpdate, data => state.replaceFromArray(data))
	ws.receive.on(FromWorker.GotPlayerActions, ({ tick, from, actions }) => {
		holder.generic.forwardPlayerActions(tick, from, actions)
	})

	return { ws, state }
}

const loadGenericSession = async (props: Props, holder: any) => {
	const sendActionsCallback: ConstructorParameters<typeof ActionsBroadcastHelper>[0]
		= (tick, actions) => holder.ws.send.send(ToWorker.BroadcastMyActions, { tick, actions })

	const generic = await createGenericSession({
		canvasProvider: props.canvasProvider,
		sendActionsCallback,
	})

	return generic
}

export const createRemoteSession = async (props: Props) => {
	const holder: any = { ws: null, generic: null }
	const [{ ws, state }, generic] = await Promise['all']([
		loadWebsocket(holder),
		loadGenericSession(props, holder)
	])
	holder.ws = ws
	holder.generic = generic


	state.observe(NetworkStateField.LatencyTicks, ticks => generic.setLatencyTicks(ticks))


	const broadcastOperation = (operation: Operation): void => {
		ws.send.send(ToWorker.BroadcastOperation, operation)
	}

	return {
		isMultiplayer: () => true,
		getState: () => state,
		async connect(to: string): Promise<void> {
			const connectionStatus = state.get(NetworkStateField.ConnectionStatus)
			if (connectionStatus !== ConnectionStatus.Disconnected && connectionStatus !== ConnectionStatus.Error)
				throw new Error('Already connected')


			ws.send.send(ToWorker.Connect, { address: to })


			if (!(await ws.receive.await(FromWorker.ConnectionMade)).success)
				throw new Error('failed to establish connection')
		},
		async joinRoom(id: string): Promise<void> {
			if (state.get(NetworkStateField.ConnectionStatus) !== ConnectionStatus.Connected)
				throw new Error('not connected')

			ws.send.send(ToWorker.JoinRoom, { roomId: id })

			if (!(await ws.receive.await(FromWorker.JoinedRoom)).ok)
				throw new Error('failed to join room')
		},
		async createNewGame(args: CreateGameArguments): Promise<void> {
			generic.createNewGame(args)
		},
		async waitForGameFromNetwork(): Promise<void> {
			const { serializedState } = await ws.receive.await(FromWorker.GotGameState)
			generic.createNewGame({ stringToRead: serializedState })
		},
		async lockRoom(lock: boolean) {
			if (state.get(NetworkStateField.ConnectionStatus) !== ConnectionStatus.Connected)
				throw new Error('not connected')
			ws.send.send(ToWorker.SetPreventJoins, { prevent: !!lock })
		},
		async broadcastGameToOthers() {
			const result = await generic
				.getEnvironment()
				.saveGame({ method: SaveMethod.ToString2 })

			if (result.method !== SaveMethod.ToString2) throw new Error()
			ws.send.send(ToWorker.BroadcastGameState, { serializedState: result.serializedState })
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
			ws.send.send(ToWorker.SetLatencyTicks, { count })
		},
		async listenForOperations() {
			while (state.get(NetworkStateField.ConnectionStatus) === ConnectionStatus.Connected) {
				const operation = await ws.receive.await(FromWorker.GotOperation)

				switch (operation.type) {
					case 'start':
						const playerIds = Object
							.entries(state.get(NetworkStateField.PlayersInRoom) ?? {})
							.filter(p => can(p[1]['role'], MemberPermissions.SendInputActions))
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
		},
		getCurrentGame: generic.getCurrentGame,
	}
}