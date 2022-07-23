import {
	CreateGameArguments,
	Environment,
	EnvironmentConnection,
	FeedbackEvent,
	getSuggestedEnvironmentName,
	loadEnvironment,
	SetActionsCallback
} from '../entry-points/feature-environments/loader'
import { StateUpdater, Status } from '../game-state/state-updater'
import { TickQueueAction, TickQueueActionType, UpdaterAction } from '../network/tick-queue-action'
import CONFIG from '../util/persistance/observable-settings'
import { Action } from './index'

interface Props {
	handleFeedbackCallback: (event: FeedbackEvent) => void

	canvasProvider: () => HTMLCanvasElement

	ticksToTakeActionProvider: () => number

	myPlayerId: () => number

	sendActionsToWorld: (tick: number, actions: TickQueueAction[]) => void

	dispatchUpdaterAction: (action: UpdaterAction) => void
	onGameLoaded: (actionsCallback: SetActionsCallback) => void

	onPauseRequested(): void

	onResumeRequested(): void
}

export const createGenericSession = async (props: Props) => {
	const myActionsForFutureTick: TickQueueAction[] = []
	let updater: StateUpdater

	const feedbackMiddleware = (event: FeedbackEvent) => {
		switch (event.type) {
			case 'input-action':
				myActionsForFutureTick.push({
					type: TickQueueActionType.GameAction,
					action: event.value,
					initiatorId: props.myPlayerId(),
				})
				break
			case 'tick-completed':
				for (const action of event.updaterActions)
					props.dispatchUpdaterAction(action)
				props.sendActionsToWorld(event.tick + props.ticksToTakeActionProvider(), [...myActionsForFutureTick])
				myActionsForFutureTick.splice(0)
				break
			default:
				props.handleFeedbackCallback(event)
				break
		}
	}

	const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
	const environment = await loadEnvironment(suggestedName, feedbackMiddleware)

	const sendEmptyActionsForInitialTicks = (currentTick: number) => {
		for (let i = 1, l = props.ticksToTakeActionProvider(); i <= l; i++)
			props.sendActionsToWorld(currentTick + i, [])
	}

	const loadGameFromArgs = (args: CreateGameArguments) => {
		environment.createNewGame({
			...args,
			existingInputActorIds: [...(args.existingInputActorIds ?? []), props.myPlayerId()],
		}).then((results) => {
			updater = results.updater
			environment.startRender({ canvas: props.canvasProvider() })

			props.onGameLoaded(results.setActionsCallback)

			sendEmptyActionsForInitialTicks(results.updater.getExecutedTicksCount())
			if (args.gameSpeed !== undefined && args.gameSpeed > 0)
				results.updater.start(args.gameSpeed)
		})
	}

	return {
		feedbackMiddleware,
		isPaused() {
			return updater?.getCurrentStatus() !== Status.Running
		},
		appendActionForNextTick(action: TickQueueAction) {
			myActionsForFutureTick.push(action)
		},
		getEnvironment(): EnvironmentConnection {
			return environment
		},
		dispatchAction(action: Action) {
			queueMicrotask(async () => {
				const type = action.type
				switch (type) {
					case 'create-game':
						loadGameFromArgs(action.args)
						break
					case 'save-game':
						environment.saveGame(action.args)
						break
					case 'pause-game':
						props.onPauseRequested()
						break
					case 'resume-game':
						props.onResumeRequested()
						break
					default:
						console.warn('Unknown task', type)
						break
				}
			})
		},
		getUpdater() {
			return updater
		},
		resetRendering() {
			environment.startRender({ canvas: props.canvasProvider() })
		},
		terminate() {
			environment.terminate({})
		},
	}
}
