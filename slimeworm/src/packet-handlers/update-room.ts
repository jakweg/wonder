import Handler from ".";

export default {
    type: 'update-room',
    handle(state, player, packet) {
        if (player.joinedRoomId === null) {
            console.warn('Player must be in a room first');
            return
        }

        if (typeof packet.preventJoining === 'boolean') {
            state.rooms.setRoomLocked(player.joinedRoomId, packet.preventJoining)
        }
    },
} as Handler<'update-room'>