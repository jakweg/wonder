import EventEmitter from '@seampan/event-emitter'
import {
  MemberPermissions,
  MemberRole,
  OwnerRole,
  RoomSnapshot,
} from '@seampan/room-snapshot'
import { info } from 'console'
import { Player } from './players-store'

interface Events {
  'updated-room': { roomId: string; snapshot: RoomSnapshot }
}

interface PlayerInRoom {
  player: Player
  role: MemberPermissions
}

interface Room {
  id: string
  preventJoining: boolean
  latencyMs: number
  players: { [key: string]: PlayerInRoom }
}

const createSnapshotFromRoom = (room: Room): RoomSnapshot => {
  return {
    id: room.id,
    preventJoining: room.preventJoining,
    latencyMs: room.latencyMs,
    players: Object.fromEntries(
      Object.entries(room.players).map(([k, v]) => [
        k,
        {
          role: v.role,
        },
      ]),
    ),
  }
}

export default class RoomStore extends EventEmitter<Events> {
  private allRooms: Map<string, Room> = new Map()

  public isLocked(roomId: string): boolean | undefined {
    return this.allRooms.get(roomId)?.preventJoining
  }
  public setLocked(roomId: string, locked: boolean): void {
    const room = this.allRooms.get(roomId)
    if (room !== undefined && room.preventJoining !== locked) {
      room.preventJoining = locked
      this.emitAsync('updated-room', {
        roomId: room.id,
        snapshot: createSnapshotFromRoom(room),
      })
    }
  }
  public setLatency(roomId: string, ms: number): void {
    const room = this.allRooms.get(roomId)
    if (room !== undefined && room.latencyMs !== ms) {
      room.latencyMs = ms
      this.emitAsync('updated-room', {
        roomId: room.id,
        snapshot: createSnapshotFromRoom(room),
      })
    }
  }

  public listPlayerIdsInRoom(roomId: string): string[] {
    const room = this.allRooms.get(roomId)
    return room !== undefined ? Object.keys(room.players) : []
  }

  public getPlayersRoleInRoom(
    roomId: string,
    playerId: string,
  ): MemberPermissions | undefined {
    return this.allRooms.get(roomId)?.players?.[playerId]?.role
  }

  public assignPlayerToRoom(player: Player, roomId: string): void {
    if (player.joinedRoomId !== null) throw new Error()

    let room: Room | undefined = this.allRooms.get(roomId)
    let newlyCreated = room === undefined
    if (room === undefined) {
      room = {
        id: roomId,
        players: {},
        preventJoining: false,
        latencyMs: 10,
      }
      this.allRooms.set(room.id, room)
      info('Created room', room.id)
    }

    player.joinedRoomId = room.id
    room.players[player.id] = {
      player,
      role: newlyCreated ? OwnerRole : MemberRole,
    }
    info('Added player', player.id, 'to room', room.id)
    this.emitAsync('updated-room', {
      roomId: room.id,
      snapshot: createSnapshotFromRoom(room),
    })
  }

  public removePlayerFromRoom(player: Player): void {
    if (player.joinedRoomId === null) return

    const room = this.allRooms.get(player.joinedRoomId)
    if (room !== undefined) {
      info('Removed player', player.id, 'from room', room.id)
      delete room.players[player.id]
      if (Object.keys(room.players).length === 0) {
        info('Deleting empty room', room.id)
        this.allRooms.delete(room.id)
      }
      this.emitAsync('updated-room', {
        roomId: room.id,
        snapshot: createSnapshotFromRoom(room),
      })
    }
    player.joinedRoomId = null
  }
}
