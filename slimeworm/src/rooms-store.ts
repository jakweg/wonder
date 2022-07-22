import { info } from "console";
import EventEmitter from '../../seampan/event-emitter';
import { Player } from "./players-store";

interface Events {
    'updated-room': { roomId: string, snapshot: RoomSnapshot }
}

export interface RoomSnapshot {
    id: string
    preventJoining: boolean
    playerIds: string[]
}

interface Room {
    id: string
    preventJoining: boolean
    assignedPlayerIds: Set<string>
}

const createSnapshotFromRoom = (room: Room): RoomSnapshot => {
    return {
        id: room.id,
        preventJoining: room.preventJoining,
        playerIds: [...room.assignedPlayerIds]
    }
}

export default class RoomStore extends EventEmitter<Events> {
    private allRooms: Map<string, Room> = new Map()

    public isRoomLocked(roomId: string): boolean | undefined {
        return this.allRooms.get(roomId)?.preventJoining
    }
    public setRoomLocked(roomId: string, locked: boolean): void {
        const room = this.allRooms.get(roomId)
        if (room !== undefined && room.preventJoining !== locked) {
            room.preventJoining = locked
            this.emitAsync('updated-room', { roomId: room.id, snapshot: createSnapshotFromRoom(room) })
        }
    }

    public getPlayerIdsInRoom(roomId: string): string[] {
        const room = this.allRooms.get(roomId);
        return room !== undefined ? [...room.assignedPlayerIds] : []
    }

    public assignPlayerToRoom(player: Player, roomId: string): void {
        if (player.joinedRoomId !== null) throw new Error()

        let room: Room | undefined = this.allRooms.get(roomId)
        if (room === undefined) {
            room = {
                id: roomId,
                assignedPlayerIds: new Set(),
                preventJoining: false,
            }
            this.allRooms.set(room.id, room)
            info('Created room', room.id)
        }

        player.joinedRoomId = room.id
        room.assignedPlayerIds.add(player.id)
        info('Added player', player.id, 'to room', room.id)
        this.emitAsync('updated-room', { roomId: room.id, snapshot: createSnapshotFromRoom(room) })
    }

    public removePlayerFromRoom(player: Player): void {
        if (player.joinedRoomId === null) return

        const room = this.allRooms.get(player.joinedRoomId)
        if (room !== undefined) {
            info('Removed player', player.id, 'from room', room.id)
            room.assignedPlayerIds.delete(player.id)
            if (room.assignedPlayerIds.size === 0) {
                info('Deleting empty room', room.id)
                this.allRooms.delete(room.id)
            }
            this.emitAsync('updated-room', { roomId: room.id, snapshot: createSnapshotFromRoom(room) })
        }
        player.joinedRoomId = null
    }
}