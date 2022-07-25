import Handler from ".";
import { can, MemberPermissions } from "../../../seampan/room-snapshot";

export default {
    type: 'update-room',
    handle(state, player, packet) {
        if (player.joinedRoomId === null) {
            console.warn('Player must be in a room first');
            return
        }

        const role = state.rooms.getPlayersRoleInRoom(player.joinedRoomId, player.id);

        if (typeof packet.preventJoining === 'boolean') {
            if (can(role, MemberPermissions.LockRoom)) {
                state.rooms.setLocked(player.joinedRoomId, packet.preventJoining)
            } else {
                console.error('missing permission')
                return
            }
        }

        if (typeof packet.latencyTicks === 'number'
            && packet.latencyTicks === (packet.latencyTicks | 0)
            && (packet.latencyTicks | 0) > 0) {
            if (can(role, MemberPermissions.SetLatencyTicks)) {
                state.rooms.setLatency(player.joinedRoomId, packet.latencyTicks)
            } else {
                console.error('missing permission')
                return
            }
        }
    },
} as Handler<'update-room'>