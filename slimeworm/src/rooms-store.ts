import { info } from "console";
import { Player } from "./players-store";

interface Room {
    id: string
    assignedPlayerIds: Set<string>
}


export default class RoomStore {
    private allRooms: Map<string, Room> = new Map()

    public assignPlayerToRoom(player: Player, roomId: string): void {
        if (player.joinedRoomId !== null) throw new Error()

        let room: Room | undefined = this.allRooms.get(roomId)
        if (room === undefined) {
            room = {
                id: roomId,
                assignedPlayerIds: new Set()
            }
            this.allRooms.set(room.id, room)
            info('Created room', room.id)
        }

        player.joinedRoomId = room.id
        room.assignedPlayerIds.add(player.id)
        info('Added player', player.id, 'to room', room.id)
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
        }
        player.joinedRoomId = null
    }
}