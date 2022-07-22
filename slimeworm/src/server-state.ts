import { PlayersStore } from "./players-store";
import RoomStore from "./rooms-store";

export interface ServerState {
    players: PlayersStore
    rooms: RoomStore
}