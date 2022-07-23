import { ClientToServer } from "../../../seampan/packet-types";
import { Player } from "../players-store";
import { ServerState } from "../server-state";
import broadcastGameState from "./broadcast-game-state";
import broadcastMyActions from "./broadcast-my-actions";
import joinRoom from "./join-room";
import updateRoom from "./update-room";

export default interface Handler<T extends keyof ClientToServer> {
    type: T

    handle(state: ServerState, sender: Player, packet: ClientToServer[T]): void
}

export const allHandlersList: Handler<keyof ClientToServer>[] = [
    joinRoom,
    updateRoom,
    broadcastGameState,
    broadcastMyActions,
]

export const allHandlers = Object.fromEntries(allHandlersList.map(h => [h.type, h]))
