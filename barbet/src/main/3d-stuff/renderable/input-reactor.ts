import { GameState } from '../../game-state/game-state'
import { ScheduledActionId } from '../../game-state/scheduled-actions'
import { ActionsQueue } from '../../game-state/scheduled-actions/queue'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { isInWorker, Lock } from '../../util/mutex'
import { globalMutex } from '../../util/worker/global-mutex'
import { MainRenderer } from '../main-renderer'
import { moveCameraByKeys } from './camera-keyboard-updater'
import { RenderContext } from './render-context'

const enum EventHappened {
	None,
	LeftClick,
	RightClick,
}

const newInputReactor = (actionsQueue: ActionsQueue) => {
	let lastClickId: number = 0
	let eventHappened: EventHappened = EventHappened.None
	let mousePositionX: number = 0
	let mousePositionY: number = 0
	let lastWidth: number = 0
	let lastHeight: number = 0
	const handleInputs = (dt: number, renderer: MainRenderer, ctx: RenderContext) => {
		moveCameraByKeys(ctx.camera, dt)

		if (lastClickId !== frontedVariables[FrontendVariable.LastMouseClickId]) {
			lastClickId = frontedVariables[FrontendVariable.LastMouseClickId]!
			mousePositionX = frontedVariables[FrontendVariable.MouseCursorPositionX]!
			mousePositionY = frontedVariables[FrontendVariable.MouseCursorPositionY]!
			const right = (frontedVariables[FrontendVariable.AdditionalFlags]! & AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight) === AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight
			eventHappened = right ? EventHappened.RightClick : EventHappened.LeftClick
		}
	}
	return async (dt: number, renderer: MainRenderer, ctx: RenderContext) => {
		handleInputs(dt, renderer, ctx)

		if (eventHappened === EventHappened.None) return

		const event = eventHappened
		eventHappened = EventHappened.None

		if (isInWorker)
			globalMutex.enter(Lock.Update)
		else
			await globalMutex.enterAsync(Lock.Update)

		const pickResult = ctx.mousePicker.pick(ctx, mousePositionX, renderer.height - mousePositionY)

		actionsQueue.append({
			type: ScheduledActionId.MouseClick,
			pick: pickResult,
			wasLeftClick: event === EventHappened.LeftClick,
		})

		globalMutex.unlock(Lock.Update)
	}
}

const createInputReactor = (game: GameState, actionsQueue: ActionsQueue) => {
	let lastClickId: number = 0
	let eventHappened: EventHappened = EventHappened.None
	let mousePositionX: number = 0
	let mousePositionY: number = 0
	let lastWidth: number = 0
	let lastHeight: number = 0
	const handleInputs = (dt: number, renderer: MainRenderer, ctx: RenderContext) => {
		moveCameraByKeys(ctx.camera, dt)
		{
			const w = frontedVariables[FrontendVariable.CanvasDrawingWidth]!
			const h = frontedVariables[FrontendVariable.CanvasDrawingHeight]!
			if (lastWidth !== w || lastHeight !== h) {
				lastWidth = w
				lastHeight = h
				ctx.camera.setAspectRatio(w / h)
				renderer.width = w
				renderer.height = h
			}
		}

		if (lastClickId !== frontedVariables[FrontendVariable.LastMouseClickId]) {
			lastClickId = frontedVariables[FrontendVariable.LastMouseClickId]!
			mousePositionX = frontedVariables[FrontendVariable.MouseCursorPositionX]!
			mousePositionY = frontedVariables[FrontendVariable.MouseCursorPositionY]!
			const right = (frontedVariables[FrontendVariable.AdditionalFlags]! & AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight) === AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight
			eventHappened = right ? EventHappened.RightClick : EventHappened.LeftClick
		}
	}
	return async (dt: number, renderer: MainRenderer, ctx: RenderContext) => {
		handleInputs(dt, renderer, ctx)

		if (eventHappened === EventHappened.None) return

		const event = eventHappened
		eventHappened = EventHappened.None

		if (isInWorker)
			globalMutex.enter(Lock.Update)
		else
			await globalMutex.enterAsync(Lock.Update)

		const pickResult = ctx.mousePicker.pick(ctx, mousePositionX, renderer.height - mousePositionY)

		actionsQueue.append({
			type: ScheduledActionId.MouseClick,
			pick: pickResult,
			wasLeftClick: event === EventHappened.LeftClick,
		})

		globalMutex.unlock(Lock.Update)
	}
}


export default createInputReactor
