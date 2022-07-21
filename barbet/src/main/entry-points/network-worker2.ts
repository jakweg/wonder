import { ClientToServer, ServerToClient } from "../../../../seampan/packet-types";
import { attachPingHandling, WrappedWebsocket, wrapWebsocket } from "../../../../seampan/ws-communication";
import { ConnectionStatus, initialState } from "../network2/initialState";
import State from "../util/state";
import { bind } from "../util/worker/message-types/network2";

const { sender, receiver } = await bind()

const state = State.fromInitial(initialState)
let wsSocket: WrappedWebsocket<ClientToServer, ServerToClient> | null = null
state.observeEverything(snapshot => sender.send('state-update', snapshot))

receiver.on('connect-to', async request => {
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

        state.update({
            "connection-status": ConnectionStatus.Connected
        })
    } catch (e) {
        wsSocket = null
        state.update({
            endpoint: null,
            "connection-status": ConnectionStatus.Error
        })
        return
    }

    wsSocket.connection.awaitDisconnected()
        .then(({ error }) => {
            state.update({
                endpoint: null,
                "connection-status": error ? ConnectionStatus.Error : ConnectionStatus.Disconnected
            })
        })

})