import { ClientToServer, ServerToClient } from "@seampan/packet-types";
import { abortAfterTimeout } from "@seampan/util";
import { attachPingHandling, WrappedWebsocket, wrapWebsocket } from "@seampan/ws-communication";
import { ConnectionStatus, initialState } from "../network/initialState";
import State from "../util/state";
import { bind, FromWorker, ToWorker } from "../util/worker/message-types/network";

const { sender, receiver } = await bind()

const state = State.fromInitial(initialState)
let wsSocket: WrappedWebsocket<ClientToServer, ServerToClient> | null = null
state.observeEverything(snapshot => sender.send(FromWorker.StateUpdate, snapshot))

receiver.on(ToWorker.Connect, async request => {
    const status = state.get('connection-status')
    if (status !== ConnectionStatus.Disconnected && status !== ConnectionStatus.Error)
        throw new Error('Already connected')

    const endpoint = request.address

    state.update({
        endpoint: endpoint,
        "connection-status": ConnectionStatus.Connecting
    })

    wsSocket = wrapWebsocket(new WebSocket(`ws://${endpoint}`))

    try {
        await wsSocket.connection.awaitConnected()
        attachPingHandling(wsSocket)

        const idPacket = await wsSocket.receive.await('your-info', abortAfterTimeout(1000).signal)


        state.update({
            "my-id": idPacket['id'],
            "connection-status": ConnectionStatus.Connected
        })
        sender.send(FromWorker.ConnectionMade, { success: true })
    } catch (e) {
        wsSocket = null
        state.update({
            endpoint: null,
            "connection-status": ConnectionStatus.Error
        })
        sender.send(FromWorker.ConnectionMade, { success: false })
        return
    }


    wsSocket.connection.awaitDisconnected()
        .then(({ error }) => {
            state.update({
                endpoint: null,
                "my-id": null,
                "room-id": null,
                "connection-status": error ? ConnectionStatus.Error : ConnectionStatus.Disconnected,
                "players-in-room": null,
            })
            sender.send(FromWorker.ConnectionDropped, null)
        })
})

receiver.on(ToWorker.JoinRoom, async ({ roomId }) => {
    if (!wsSocket || state.get('connection-status') !== ConnectionStatus.Connected)
        throw new Error('not connected')
    if (state.get('room-id') !== null)
        throw new Error('already is room')

    wsSocket.send.send('join-room', { 'roomId': roomId })

    const packet = (await wsSocket.receive.await('joined-room'))
    if (!packet['ok']) {
        sender.send(FromWorker.JoinedRoom, { ok: false })
        return
    }
    const myRoomId = packet['roomId']

    state.update({
        'room-id': myRoomId
    })

    sender.send(FromWorker.JoinedRoom, { ok: true, roomId: myRoomId })

    const doReceiveRoomUpdates = async () => {
        while (state.get('room-id') === myRoomId && wsSocket?.connection.isConnected()) {
            const snapshot = await wsSocket.receive.await('room-info-update')
            state.update({
                "room-is-locked": snapshot['preventJoining'],
                "latency-ticks": snapshot['latencyTicks'],
                "players-in-room": snapshot['players'],
            })
        }
    }

    const doReceiveGameState = async () => {
        while (state.get('room-id') === myRoomId && wsSocket?.connection.isConnected()) {
            const packet = await wsSocket.receive.await('game-state-broadcast')
            sender.send(FromWorker.GotGameState, { serializedState: packet['serializedState'] })
        }
    }

    const doReceivePlayerActions = async () => {
        while (state.get('room-id') === myRoomId && wsSocket?.connection.isConnected()) {
            const packet = await wsSocket.receive.await('players-actions')
            sender.send(FromWorker.GotPlayerActions, {
                from: packet['from'],
                tick: packet['tick'],
                actions: packet['actions'],
            })
        }
    }

    const doReceiveOperations = async () => {
        while (state.get('room-id') === myRoomId && wsSocket?.connection.isConnected()) {
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