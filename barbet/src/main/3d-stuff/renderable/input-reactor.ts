import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { isInWorker, Lock } from '../../util/mutex'
import { globalMutex } from '../../worker/worker-global-state'
import { GameState } from '../game-state/game-state'
import { MainRenderer } from '../main-renderer'
import { MousePickableType, MousePickerResultAny, MousePickerTerrainResult } from '../mouse-picker'
import { BlockId } from '../world/block'
import { moveCameraByKeys } from './camera-keyboard-updater'
import { RenderContext } from './render-context'

const enum EventHappened {
	None,
	LeftClick,
	RightClick,
}

const createInputReactor = (game: GameState) => {
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

		handlePick(pickResult, event, game)

		// if (pickResult !== null && pickResult.pickedType !== MousePickableType.Nothing) {
		// 	const entityContainer = game.entities
		// 	const result = pickResult
		// 	if (result.pickedType === MousePickableType.Terrain) {
		// 		let wasAny = false
		// 		const entities = iterateOverAllSelectedEntities(entityContainer)
		// 		if (game.groundItems.getItem(result.x, result.z) !== ItemType.None) {
		// 			for (const record of entities) {
		// 				if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
		// 					continue
		// 				wasAny = true
		// 				interruptRequestItemPickUp(entityContainer, record, result.x, result.z, ItemType.Box)
		// 			}
		// 		} else
		// 			for (const record of entities) {
		// 				if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
		// 					continue
		// 				wasAny = true
		// 				interruptRequestWalk(entityContainer, record, result.x, result.z)
		// 			}
		//
		// 		if (!wasAny) {
		// 			if (event === EventHappened.LeftClick)
		// 				// world.setBlock(result.x + result.normals[0]!, result.y + result.normals[1]!, result.z + result.normals[2]!, BlockId.Snow)
		// 				game.groundItems.setItem(result.x, result.z, ItemType.Box)
		// 			else
		// 				game.world.setBlock(result.x, result.y, result.z, BlockId.Air)
		// 		}
		// 	} else if (result.pickedType === MousePickableType.Unit) {
		// 		const id = result.numericId
		// 		const record = getEntityById_drawableItem(entityContainer, id)
		// 		if (record !== null) {
		// 			{
		// 				const rawData = entityContainer.drawables.rawData
		// 				let color = rawData[record.drawable + DataOffsetDrawables.ColorPaletteId]! as UnitColorPaletteId
		// 				color = (color === UnitColorPaletteId.DarkBlue) ? UnitColorPaletteId.GreenOrange : UnitColorPaletteId.DarkBlue
		// 				rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] = color
		// 			}
		// 			if (event === EventHappened.RightClick) {
		// 				const rawData = entityContainer.itemHoldables.rawData
		// 				let item = rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType
		// 				item = (item === ItemType.Box) ? ItemType.None : ItemType.Box
		// 				rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId] = item
		// 			}
		// 		}
		// 	}
		// }

		globalMutex.unlock(Lock.Update)
	}
}

const handlePick = (pickResult: MousePickerResultAny, event: EventHappened, game: GameState) => {
	switch (pickResult.pickedType) {
		case MousePickableType.Terrain:
			handlePickBlock(pickResult, event, game)
			break
	}
}


const handlePickBlock = (result: MousePickerTerrainResult, event: EventHappened, game: GameState) => {
	switch (event) {
		case EventHappened.LeftClick:
			game.world.setBlock(result.x + result.normals[0], result.y + result.normals[1], result.z + result.normals[2], BlockId.Gravel)
			break
		case EventHappened.RightClick:
			game.world.setBlock(result.x, result.y, result.z, BlockId.Air)
			break
	}
}

export default createInputReactor
