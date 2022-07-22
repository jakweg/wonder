import { ClientToServer } from "../../../seampan/packet-types";
import { Player } from "../players-store";
import { ServerState } from "../server-state";
import joinRoom from "./join-room";

export default interface Handler<T extends keyof ClientToServer> {
    type: T

    handle(state: ServerState, sender: Player, packet: ClientToServer[T]): void
}

export const allHandlersList: Handler<keyof ClientToServer>[] = [
    joinRoom
]

export const allHandlers = Object.fromEntries(allHandlersList.map(h => [h.type, h]))