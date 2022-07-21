export interface BothWayPackets {
    'ping': { noonce: number },
    'pong': { noonce: number },
}

export interface ClientToServer extends BothWayPackets {
}

export interface ServerToClient extends BothWayPackets {

}