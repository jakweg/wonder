import { PlayerInRoom } from '@seampan/room-snapshot'

export enum ConnectionStatus {
  Disconnected,
  Connecting,
  Connected,
  Error,
}

export const enum NetworkStateField {
  Endpoint,
  ConnectionStatus,
  MyId,
  RoomId,
  PlayersInRoom,
  RoomIsLocked,
  LatencyTicks,
}

export const defaults = {
  [NetworkStateField.Endpoint]: null as null | string,
  [NetworkStateField.ConnectionStatus]: ConnectionStatus.Disconnected,
  [NetworkStateField.MyId]: null as null | string,
  [NetworkStateField.RoomId]: null as null | string,
  [NetworkStateField.PlayersInRoom]: null as null | { [key: string]: PlayerInRoom },
  [NetworkStateField.RoomIsLocked]: null as null | boolean,
  [NetworkStateField.LatencyTicks]: 10 as number,
}
