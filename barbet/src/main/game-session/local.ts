import { GameSession } from '.'
import { createGenericSession } from './generic'

interface Props {
    canvasProvider: () => HTMLCanvasElement
}

const LOCAL_PLAYER_ID = '~'

export type LocalSession = Awaited<ReturnType<typeof createLocalSession>>
export const createLocalSession = async (props: Props) => {
    let generic: Awaited<ReturnType<typeof createGenericSession>>
    generic = await createGenericSession({
        canvasProvider: props.canvasProvider,
        sendActionsCallback: (tick, actions) => generic.forwardPlayerActions(tick, LOCAL_PLAYER_ID, actions)
    })

    return {
        async createNewGame(args) {
            await generic.createNewGame(args)
        },
        isMultiplayer() {
            return false
        },
        isPaused() {
            return generic.isRunning() === false
        },
        pause: generic.stop,
        resume: (tps) => {
            generic.start([LOCAL_PLAYER_ID], tps)
        },
        terminate: generic.terminate,
    } as GameSession
}