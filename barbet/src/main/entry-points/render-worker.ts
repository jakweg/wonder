import { Camera } from '../3d-stuff/camera'
import { createRenderingSession } from '../3d-stuff/renderable/render-context'
import { createGameStateForRenderer, GameState } from '../game-state/game-state'
import { SendActionsQueue } from '../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived } from '../game-state/state-updater'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import CONFIG from '../util/persistance/observable-settings'
import { bind, FromWorker, ToWorker } from '../util/worker/message-types/render'

const { sender, receiver, start } = await bind()
const actionsQueue = SendActionsQueue.create(action => sender.send(FromWorker.ScheduledAction, action))
const session = await createRenderingSession(actionsQueue)
start()

let workerStartDelayDifference = 0
let gameSnapshot: unknown | null = null
let decodedGame: GameState | null = null

receiver.on(ToWorker.NewSettings, settings => {
	CONFIG.update(settings)
})

receiver.on(ToWorker.TransferCanvas, (data) => {
	const canvas = data.canvas as HTMLCanvasElement
	session.setCanvas(canvas)
})

receiver.on(ToWorker.SetWorkerLoadDelays, (data) => {
	workerStartDelayDifference = data.update - data.render
})

receiver.on(ToWorker.GameCreateResult, (data) => {
	gameSnapshot = data.game
	const snapshot = data as any
	const game = decodedGame = createGameStateForRenderer(snapshot.game)
	const decodedUpdater = createStateUpdaterControllerFromReceived(snapshot.updater)
	const gameTickEstimation = () => decodedUpdater!.estimateCurrentGameTickTime(workerStartDelayDifference)
	session.setGame(game, gameTickEstimation, () => decodedUpdater.getTickRate())
})

receiver.on(ToWorker.UpdateEntityContainer, (data) => {
	decodedGame!.entities.replaceBuffersFromReceived(data)
})

receiver.on(ToWorker.CameraBuffer, (data) => {
	session.setCamera(Camera.newUsingBuffer(data.buffer))
})

receiver.on(ToWorker.FrontendVariables, (data) => {
	initFrontedVariablesFromReceived(data.buffer)
})

receiver.on(ToWorker.TerminateGame, args => {
	session.cleanUp()
	if (args.terminateEverything)
		close()
})