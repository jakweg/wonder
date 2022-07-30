import { PlayerInRoom } from "../../../../seampan/room-snapshot";

export enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

export const initialState = {
    'endpoint': null as (null | string),
    'connection-status': ConnectionStatus.Disconnected,
    'my-id': null as (null | string),
    'room-id': null as (null | string),
    'players-in-room': null as (null | { [key: string]: PlayerInRoom }),
    'room-is-locked': null as (null | boolean),
    'latency-ticks': 10 as number
};
