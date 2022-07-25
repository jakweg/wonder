import Handler from ".";

export default {
    type: 'broadcast-operation',
    handle(state, player, packet) {

        if (player.joinedRoomId === null) {
            console.warn('Player must join room first');
            return
        }

        for (const playerId of state.rooms.listPlayerIdsInRoom(player.joinedRoomId)) {
            const other = state.players.getById(playerId)
            if (other !== undefined) {
                other.ws.send.send('invoked-operation', {
                    who: player.id,
                    operation: packet
                })
            }
        }
    },
} as Handler<'broadcast-operation'>