import Handler from ".";
import { can, MemberPermissions } from "@seampan/room-snapshot";

export default {
    type: 'broadcast-game-state',
    handle(state, player, packet) {
        if (player.joinedRoomId === null) {
            console.warn('Player must join room first');
            return
        }

        if (state.rooms.isLocked(player.joinedRoomId) !== true) {
            console.warn('room needs to be locked first');
            return
        }

        const role = state.rooms.getPlayersRoleInRoom(player.joinedRoomId, player.id)
        if (!can(role, MemberPermissions.SendGameState)) {
            console.warn('missing permission');
            return
        }

        for (const playerId of state.rooms.listPlayerIdsInRoom(player.joinedRoomId)) {
            if (playerId !== player.id) {
                const other = state.players.getById(playerId)
                if (other !== undefined) {
                    other.ws.send.send('game-state-broadcast', { serializedState: packet.serializedState })
                }
            }
        }
    },
} as Handler<'broadcast-game-state'>