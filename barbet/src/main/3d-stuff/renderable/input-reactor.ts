import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { Lock } from '../../util/mutex'
import { globalMutex } from '../../worker/worker-global-state'
import { interruptRequestItemPickUp, interruptRequestWalk } from '../game-state/activities/interrupt'
import { getEntityById_drawableItem, iterateOverAllSelectedEntities } from '../game-state/entities/queries'
import { DataOffsetDrawables, DataOffsetItemHoldable } from '../game-state/entities/traits'
import { GameState } from '../game-state/game-state'
import { MousePickableType } from '../mouse-picker'
import { BlockId } from '../world/block'
import { ItemType } from '../world/item'
import { moveCameraByKeys } from './camera-keyboard-updater'
import { RenderContext } from './render-context'
import { UnitColorPaletteId } from './unit/unit-color'

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
	const handleInputsSecure = async (dt: number, ctx: RenderContext) => {
		await moveCameraByKeys(ctx.camera, dt)

		if (lastClickId !== frontedVariables[FrontendVariable.LastMouseClickId]) {
			lastClickId = frontedVariables[FrontendVariable.LastMouseClickId]!
			mousePositionX = frontedVariables[FrontendVariable.MouseCursorPositionX]!
			mousePositionY = frontedVariables[FrontendVariable.MouseCursorPositionY]!
			const right = (frontedVariables[FrontendVariable.AdditionalFlags]! & AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight) === AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight
			eventHappened = right ? EventHappened.RightClick : EventHappened.LeftClick
		}
	}
	return async (dt: number, ctx: RenderContext) => {
		globalMutex.executeWithAcquired(Lock.FrontedVariables, () => handleInputsSecure(dt, ctx))
		if (eventHappened !== EventHappened.None) {
			const event = eventHappened
			eventHappened = EventHappened.None
			let pickResult = null as unknown as (ReturnType<typeof ctx.mousePicker.pick>)
			globalMutex.executeWithAcquired(Lock.Update, () => {
				pickResult = ctx.mousePicker.pick(ctx, mousePositionX, mousePositionY)
			})
			if (pickResult !== null && pickResult.pickedType !== MousePickableType.Nothing) {
				globalMutex.executeWithAcquired(Lock.Update, () => {
					const entityContainer = game.entities
					const result = pickResult
					if (result.pickedType === MousePickableType.Terrain) {
						let wasAny = false
						const entities = iterateOverAllSelectedEntities(entityContainer)
						if (game.groundItems.getItem(result.x, result.z) !== ItemType.None) {
							for (const record of entities) {
								if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
									continue
								wasAny = true
								interruptRequestItemPickUp(entityContainer, record, result.x, result.z, ItemType.Box)
							}
						} else
							for (const record of entities) {
								if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
									continue
								wasAny = true
								interruptRequestWalk(entityContainer, record, result.x, result.z)
							}

						if (!wasAny) {
							if (event === EventHappened.LeftClick)
								// world.setBlock(result.x + result.normals[0]!, result.y + result.normals[1]!, result.z + result.normals[2]!, BlockId.Snow)
								game.groundItems.setItem(result.x, result.z, ItemType.Box)
							else
								game.world.setBlock(result.x, result.y, result.z, BlockId.Air)
						}
					} else if (result.pickedType === MousePickableType.Unit) {
						const id = result.numericId
						const record = getEntityById_drawableItem(entityContainer, id)
						if (record !== null) {
							{
								const rawData = entityContainer.drawables.rawData
								let color = rawData[record.drawable + DataOffsetDrawables.ColorPaletteId]! as UnitColorPaletteId
								color = (color === UnitColorPaletteId.DarkBlue) ? UnitColorPaletteId.GreenOrange : UnitColorPaletteId.DarkBlue
								rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] = color
							}
							if (event === EventHappened.RightClick) {
								const rawData = entityContainer.itemHoldables.rawData
								let item = rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType
								item = (item === ItemType.Box) ? ItemType.None : ItemType.Box
								rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId] = item
							}
						}
					}
				})
			}
		}
	}
}

export default createInputReactor
