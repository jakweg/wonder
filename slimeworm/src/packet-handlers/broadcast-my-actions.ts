import { can, MemberPermissions } from "@seampan/room-snapshot";
import Handler from ".";

export default {
    type: 'broadcast-my-actions',
    handle(state, player, packet) {

        if (player.joinedRoomId === null) {
            console.warn('Player must join room first');
            return
        }

        if (state.rooms.isLocked(player.joinedRoomId) !== true) {
            console.warn('room needs to be locked first');
            return
        }

        if (!can(state.rooms.getPlayersRoleInRoom(player.joinedRoomId, player.id), MemberPermissions.SendInputActions)) {
            console.warn('missing permission');
            return
        }

        for (const playerId of state.rooms.listPlayerIdsInRoom(player.joinedRoomId)) {
            const role = state.rooms.getPlayersRoleInRoom(player.joinedRoomId, playerId);
            if (!can(role, MemberPermissions.ReceiveInputActions))
                continue

            const other = state.players.getById(playerId)
            if (other !== undefined) {
                other.ws.send.send('players-actions', {
                    from: player.id,
                    actions: packet.actions,
                    tick: packet.tick,
                })
            }
        }
    },
} as Handler<'broadcast-my-actions'>