import { ClientToServer, ServerToClient } from "@seampan/packet-types";
import { abortAfterTimeout } from "@seampan/util";
import { attachPingHandling, WrappedWebsocket, wrapWebsocket } from "@seampan/ws-communication";
import { ConnectionStatus, defaults, NetworkStateField } from "../network/state";
import IndexedState from "../util/state/indexed-state";
import { bind, FromWorker, ToWorker } from "../util/worker/message-types/network";

const { sender, receiver } = await bind()

const state = IndexedState.fromObject(defaults)
let wsSocket: WrappedWebsocket<ClientToServer, ServerToClient> | null = null
state.observeEverything(snapshot => sender.send(FromWorker.StateUpdate, snapshot))

receiver.on(ToWorker.Connect, async request => {
    const status = state.get(NetworkStateField.ConnectionStatus)
    if (status !== ConnectionStatus.Disconnected && status !== ConnectionStatus.Error)
        throw new Error('Already connected')

    const endpoint = request.address

    state.edit()
        .set(NetworkStateField.Endpoint, endpoint,)
        .set(NetworkStateField.ConnectionStatus, ConnectionStatus.Connected)
        .commit()

    wsSocket = wrapWebsocket(new WebSocket(`ws://${endpoint}`))

    try {
        await wsSocket.connection.awaitConnected()
        attachPingHandling(wsSocket)

        const idPacket = await wsSocket.receive.await('your-info', abortAfterTimeout(1000).signal)


        state.edit()
            .set(NetworkStateField.MyId, idPacket['id'],)
            .set(NetworkStateField.ConnectionStatus, ConnectionStatus.Connected)
            .commit()

        sender.send(FromWorker.ConnectionMade, { success: true })
    } catch (e) {
        wsSocket = null
        state.edit()
            .set(NetworkStateField.MyId, null,)
            .set(NetworkStateField.Endpoint, null,)
            .set(NetworkStateField.ConnectionStatus, ConnectionStatus.Error)
            .commit()

        sender.send(FromWorker.ConnectionMade, { success: false })
        return
    }


    wsSocket.connection.awaitDisconnected()
        .then(({ error }) => {
            state.edit()
                .set(NetworkStateField.MyId, null,)
                .set(NetworkStateField.Endpoint, null,)
                .set(NetworkStateField.ConnectionStatus, error ? ConnectionStatus.Error : ConnectionStatus.Disconnected)
                .set(NetworkStateField.PlayersInRoom, null)
                .commit()

            sender.send(FromWorker.ConnectionDropped, null)
        })
})

receiver.on(ToWorker.JoinRoom, async ({ roomId }) => {
    if (!wsSocket || state.get(NetworkStateField.ConnectionStatus) !== ConnectionStatus.Connected)
        throw new Error('not connected')
    if (state.get(NetworkStateField.RoomId) !== null)
        throw new Error('already is room')

    wsSocket.send.send('join-room', { 'roomId': roomId })

    const packet = (await wsSocket.receive.await('joined-room'))
    if (!packet['ok']) {
        sender.send(FromWorker.JoinedRoom, { ok: false })
        return
    }
    const myRoomId = packet['roomId']

    state.set(
        NetworkStateField.RoomId, myRoomId
    )

    sender.send(FromWorker.JoinedRoom, { ok: true, roomId: myRoomId })

    const doReceiveRoomUpdates = async () => {
        while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
            const snapshot = await wsSocket.receive.await('room-info-update')
            state.edit()
                .set(NetworkStateField.RoomIsLocked, snapshot['preventJoining'],)
                .set(NetworkStateField.LatencyTicks, snapshot['latencyTicks'],)
                .set(NetworkStateField.PlayersInRoom, snapshot['players'],)
                .commit()
        }
    }

    const doReceiveGameState = async () => {
        while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
            const packet = await wsSocket.receive.await('game-state-broadcast')
            sender.send(FromWorker.GotGameState, { serializedState: packet['serializedState'] })
        }
    }

    const doReceivePlayerActions = async () => {
        while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
            const packet = await wsSocket.receive.await('players-actions')
            sender.send(FromWorker.GotPlayerActions, {
                from: packet['from'],
                tick: packet['tick'],
                actions: packet['actions'],
            })
        }
    }

    const doReceiveOperations = async () => {
        while (state.get(NetworkStateField.RoomId) === myRoomId && wsSocket?.connection.isConnected()) {
            const packet = await wsSocket.receive.await('invoked-operation')
            sender.send(FromWorker.GotOperation, packet['operation'])
        }
    }

    void doReceiveRoomUpdates()
    void doReceiveGameState()
    void doReceivePlayerActions()
    void doReceiveOperations()

})

receiver.on(ToWorker.SetPreventJoins, ({ prevent }) => {
    wsSocket?.send.send('update-room', { 'preventJoining': prevent })
})

receiver.on(ToWorker.SetLatencyTicks, ({ count }) => {
    wsSocket?.send.send('update-room', { 'latencyTicks': count })
})

receiver.on(ToWorker.BroadcastGameState, ({ serializedState }) => {
    wsSocket?.send.send('broadcast-game-state', { 'serializedState': serializedState })
})

receiver.on(ToWorker.BroadcastMyActions, ({ tick, actions }) => {
    wsSocket?.send.send('broadcast-my-actions', { 'tick': tick, 'actions': actions })
})

receiver.on(ToWorker.BroadcastOperation, operation => {
    wsSocket?.send.send('broadcast-operation', operation)
})