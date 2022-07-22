export interface BothWayPackets {
    'ping': { noonce: number },
    'pong': { noonce: number },
}

export interface ClientToServer extends BothWayPackets {
    'join-room': { roomId: string }
}

export interface ServerToClient extends BothWayPackets {
    'your-info': { id: string }
    'joined-room': { roomId: string }
}