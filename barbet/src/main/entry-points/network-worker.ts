import { ClientToServer, ServerToClient } from '@seampan/packet-types'
import { abortAfterTimeout } from '@seampan/util'
import { attachPingHandling, WrappedWebsocket, wrapWebsocket } from '@seampan/ws-communication'
import { bind } from '@utils/new-worker/specs/network'
import IndexedState from '@utils/state/indexed-state'
import { ConnectionStatus, defaults, NetworkStateField } from '../network/state'

const state = IndexedState.fromObject(defaults)

let wsSocket: WrappedWebsocket<ClientToServer, ServerToClient> | null = null

const functions = bind({
  async connect(request) {
    const status = state.get(NetworkStateField.ConnectionStatus)
    if (status !== ConnectionStatus.Disconnected && status !== ConnectionStatus.Error)
      throw new Error('Already connected')

    const endpoint = request.address

    state
      .edit()
      .set(NetworkStateField.Endpoint, endpoint)
      .set(NetworkStateField.ConnectionStatus, ConnectionStatus.Connected)
      .commit()

    wsSocket = wrapWebsocket(new WebSocket(`ws://${endpoint}`))

    try {
      await wsSocket.connection.awaitConnected()
      attachPingHandling(wsSocket)

      const idPacket = await wsSocket.receive.await('your-info', abortAfterTimeout(1000).signal)

      state
        .edit()
        .set(NetworkStateField.MyId, idPacket['id'])
        .set(NetworkStateField.ConnectionStatus, ConnectionStatus.Connected)
        .commit()

      return { success: true }
    } catch (e) {
      wsSocket?.connection?.close()
      wsSocket = null
      state
        .edit()
        .set(NetworkStateField.MyId, null)
        .set(NetworkStateField.Endpoint, null)
        .set(NetworkStateField.ConnectionStatus, ConnectionStatus.Error)
        .commit()

      return { success: false }
    } finally {
      wsSocket?.connection.awaitDisconnected().then(({ error }) => {
        state
          .edit()
          .set(NetworkStateField.MyId, null)
          .set(NetworkStateField.Endpoint, null)
          .set(NetworkStateField.ConnectionStatus, error ? ConnectionStatus.Error : ConnectionStatus.Disconnected)
          .set(NetworkStateField.PlayersInRoom, null)
          .commit()

        functions.onConnectionDropped(null)
      })
    }
  },
  async joinRoom({ roomId }) {
    if (!wsSocket || state.get(NetworkStateField.ConnectionStatus) !== ConnectionStatus.Connected)
      throw new Error('not connected')
    if (state.get(NetworkStateField.RoomId) !== null) throw new Error('already is room')

    wsSocket.send.send('join-room', { 'roomId': roomId })

    const packet = await wsSocket.receive.await('joined-room')
    if (!packet['ok']) {
      return { ok: false }
    }
    const myRoomId = packet['roomId']

    state.set(NetworkStateField.RoomId, myRoomId)

    const doReceiveRoomUpdates = async () => {
      while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
        const snapshot = await wsSocket.receive.await('room-info-update')
        state
          .edit()
          .set(NetworkStateField.RoomIsLocked, snapshot['preventJoining'])
          .set(NetworkStateField.LatencyMilliseconds, snapshot['latencyMs'])
          .set(NetworkStateField.PlayersInRoom, snapshot['players'])
          .commit()
      }
    }

    const doReceiveGameState = async () => {
      while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
        const packet = await wsSocket.receive.await('game-state-broadcast')
        functions.onGameState({ serializedState: packet['serializedState'] })
      }
    }

    const doReceivePlayerActions = async () => {
      while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
        const packet = await wsSocket.receive.await('players-actions')
        functions.onPlayerActions({
          from: packet['from'],
          tick: packet['tick'],
          actions: packet['actions'],
        })
      }
    }

    const doReceiveOperations = async () => {
      while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
        const packet = await wsSocket.receive.await('invoked-operation')
        functions.onGotOperation(packet['operation'])
      }
    }

    void doReceiveRoomUpdates()
    void doReceiveGameState()
    void doReceivePlayerActions()
    void doReceiveOperations()

    return { ok: true, roomId: myRoomId }
  },
  setPreventJoins({ prevent }) {
    wsSocket?.send.send('update-room', { 'preventJoining': prevent })
  },
  setLatencyMilliseconds({ ms: count }) {
    wsSocket?.send.send('update-room', { 'latencyMs': count })
  },
  broadcastGameState({ serializedState }) {
    wsSocket?.send.send('broadcast-game-state', { 'serializedState': serializedState })
  },
  broadcastMyActions({ tick, actions }) {
    wsSocket?.send.send('broadcast-my-actions', { 'tick': tick, 'actions': actions })
  },
  broadcastOperation(operation) {
    wsSocket?.send.send('broadcast-operation', operation)
  },
})

state.observeEverything(snapshot => functions.onStateUpload(snapshot))
