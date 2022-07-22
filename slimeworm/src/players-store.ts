
import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import { ClientToServer, ServerToClient } from "../../seampan/packet-types";
import { attachPingHandling, WrappedWebsocket, wrapWebsocket } from "../../seampan/ws-communication";

export interface Player {
    id: string
    ws: WrappedWebsocket<ServerToClient, ClientToServer>
    pinger: ReturnType<typeof attachPingHandling>
    joinedRoomId: string | null
}

export class PlayersStore {
    private allPlayers: Player[] = []

    public addPlayerFromSocket(socket: WebSocket): Player {
        const ws = wrapWebsocket<ServerToClient, ClientToServer>(socket)
        const pinger = attachPingHandling(ws)
        pinger.send()

        const player: Player = {
            id: randomUUID(),
            ws, pinger, joinedRoomId: null
        };

        this.allPlayers.push(player)
        ws.connection
            .awaitDisconnected()
            .then(() => {
                const index = this.allPlayers.indexOf(player)
                if (index >= 0)
                    this.allPlayers.splice(index, 1)
            })

        ws.send.send('your-info', { id: player.id })

        return player
    }

    public getById(id: string): Player | undefined {
        return this.allPlayers.find(e => e.id === id)
    }
}

