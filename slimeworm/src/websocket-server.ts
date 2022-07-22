import { info } from 'console'
import { WebSocketServer } from 'ws'
import { allHandlers } from './packet-handlers'
import { Player, PlayersStore } from './players-store'
import RoomStore from './rooms-store'
import { ServerState } from './server-state'

// @ts-ignore
const port = +process?.env?.PORT || 3719

const server = new WebSocketServer({ port })

const contex: ServerState = {
    players: new PlayersStore(),
    rooms: new RoomStore(),
}

server.on('listening', () => {
    const address = server.address()
    const asString =
        typeof address === 'string' ? address : 'localhost:' + address.port
    console.log(`Listening at http://${asString}`)
})

server.on('connection', async (socket) => {
    const player = contex.players.addPlayerFromSocket(socket)

    player.ws.connection.awaitDisconnected()
        .then(() => contex.rooms.removePlayerFromRoom(player))

    info('Connected player', player.id)

    await serveNewPlayer(player)
})

contex.rooms.on('updated-room', ({ roomId, snapshot }) => {
    const packetValue = {
        roomId: snapshot.id,
        preventJoining: snapshot.preventJoining,
        playerIds: snapshot.playerIds
    }

    for (const playerId of contex.rooms.getPlayerIdsInRoom(roomId)) {
        contex.players.getById(playerId)?.ws?.send
            ?.send('room-info-update', packetValue)
    }
})


export const serveNewPlayer = async (p: Player) => {
    while (p.ws.connection.isConnected()) {
        const [type, data] = await p.ws.receive.awaitNext()

        const handler = allHandlers[type]
        if (handler !== undefined) {
            handler.handle(contex, p, data[type] as any)
        } else {
            console.error('Received invalid packet', type);
            p.ws.connection.close()
            return
        }
    }
}

