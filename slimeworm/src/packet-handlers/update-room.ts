import { can, MemberPermissions } from '@seampan/room-snapshot'
import Handler from '.'

export default {
  type: 'update-room',
  handle(state, player, packet) {
    if (player.joinedRoomId === null) {
      console.warn('Player must be in a room first')
      return
    }

    const role = state.rooms.getPlayersRoleInRoom(
      player.joinedRoomId,
      player.id,
    )

    if (typeof packet.preventJoining === 'boolean') {
      if (can(role, MemberPermissions.LockRoom)) {
        state.rooms.setLocked(player.joinedRoomId, packet.preventJoining)
      } else {
        console.error('missing permission')
        return
      }
    }

    if (
      typeof packet.latencyMs === 'number' &&
      packet.latencyMs === (packet.latencyMs | 0) &&
      (packet.latencyMs | 0) > 0
    ) {
      if (can(role, MemberPermissions.SetLatencyMilliseconds)) {
        state.rooms.setLatency(player.joinedRoomId, packet.latencyMs)
      } else {
        console.error('missing permission')
        return
      }
    }
  },
} as Handler<'update-room'>
