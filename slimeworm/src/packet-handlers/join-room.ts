import Handler from ".";

export default {
    type: 'join-room',
    handle(state, player, packet) {
        if (player.joinedRoomId !== null) {
            console.warn('Player must leave room first');
            return
        }

        const roomToJoin = packet.roomId
        if (!(typeof roomToJoin === "string" && roomToJoin.length >= 4 && roomToJoin.length <= 30)) {
            player.ws.send.send('joined-room', { ok: false, })
            return
        }

        if (roomToJoin !== 'default') {
            player.ws.send.send('joined-room', { ok: false, })
            return
        }

        if (state.rooms.isLocked(roomToJoin) === true) {
            player.ws.send.send('joined-room', { ok: false, })
            return
        }

        state.rooms.assignPlayerToRoom(player, roomToJoin)
        player.ws.send.send('joined-room', { ok: true, roomId: player.joinedRoomId! })
    },
} as Handler<'join-room'>