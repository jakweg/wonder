import { WebSocketServer } from 'ws'
import { ClientToServer, ServerToClient } from '../../seampan/packet-types'
import { attachPingHandling, wrapWebsocket } from '../../seampan/ws-communication'

// @ts-ignore
const port = +process?.env?.PORT || 3719

const server = new WebSocketServer({ port })

server.on('listening', () => {
    const address = server.address()
    const asString =
        typeof address === 'string' ? address : 'localhost:' + address.port
    console.log(`Listening at http://${asString}`)
})

server.on('connection', (socket) => {
    const ws = wrapWebsocket<ServerToClient, ClientToServer>(socket)
    const pinger = attachPingHandling(ws)
    pinger.send()
})
