
export const enum PlayerRole {
    Owner,
    Member,
}

export type PlayerInRoom = { role: PlayerRole }

export interface RoomSnapshot {
    id: string
    preventJoining: boolean
    players: { [key: string]: PlayerInRoom }
}
