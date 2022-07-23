import { RoomSnapshot } from './room-snapshot'

export interface BothWayPackets {
    'ping': { noonce: number }
    'pong': { noonce: number }
}

export interface ClientToServer extends BothWayPackets {
    'join-room': { roomId: string }
    'update-room': Partial<{ preventJoining: boolean }>
}

export interface ServerToClient extends BothWayPackets {
    'your-info': { id: string }
    'joined-room': { ok: true, roomId: string } | { ok: false }
    'room-info-update': RoomSnapshot
}