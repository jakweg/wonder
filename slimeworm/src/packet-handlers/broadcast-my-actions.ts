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

        for (const playerId of state.rooms.listPlayerIdsInRoom(player.joinedRoomId)) {
            // if (playerId === player.id) continue // TODO should that check be uncommented?
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