import { SetActionsCallback } from '../entry-points/feature-environments/loader'
import { TickQueueAction } from '../network/tick-queue-action'
import { GameSession, GenericSessionProps } from './'
import { createGenericSession } from './generic'


export const createLocalSession = async (props: GenericSessionProps): Promise<GameSession> => {

	let forwardReceivedActionsCallback: SetActionsCallback | null = null

	const sendActionsToWorld = (tick: number, actions: TickQueueAction[]) => {
		forwardReceivedActionsCallback?.(tick, 1, actions)
	}

	const generic = await createGenericSession({
		canvasProvider: props.canvasProvider,
		handleFeedbackCallback: props.feedbackCallback,
		ticksToTakeActionProvider: () => 2,
		myPlayerId: () => 1,
		sendActionsToWorld,
		dispatchUpdaterAction: () => void 0,
		onPauseRequested() {
			generic.getUpdater().stop()
		},
		onResumeRequested() {
			generic.getUpdater().start(generic.getUpdater().getTickRate())
		},
		onGameLoaded: (callback) => {
			forwardReceivedActionsCallback = callback
		},
	})

	return {
		isPaused: generic.isPaused,
		dispatchAction: generic.dispatchAction,
		resetRendering: generic.resetRendering,
		terminate: generic.terminate,
	}
}
