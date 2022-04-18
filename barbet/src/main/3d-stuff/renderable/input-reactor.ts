import { BuildingId, requireBuilding } from '../../game-state/buildings'
import { DataOffsetBuildingData, DataOffsetPositions, EntityTrait } from '../../game-state/entities/traits'
import { GameState, MetadataField } from '../../game-state/game-state'
import { AIR_ID, BlockId } from '../../game-state/world/block'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { isInWorker, Lock } from '../../util/mutex'
import { globalMutex } from '../../worker/worker-global-state'
import { MainRenderer } from '../main-renderer'
import { MousePickableType, MousePickerResultAny, MousePickerTerrainResult } from '../mouse-picker'
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

export const spawnBuilding = (game: GameState, centerX: number, centerZ: number, type: BuildingId) => {
	const building = requireBuilding(type)

	const areaStartX = centerX - (building.maskSizeX / 2 | 0)
	const areaStartZ = centerZ - (building.maskSizeZ / 2 | 0)

	let previousY = -1
	for (let x = 0; x < building.maskSizeX; x++) {
		for (let z = 0; z < building.maskSizeZ; z++) {
			const canPlaceBuilding = game.tileMetaDataIndex.canPlaceBuilding(areaStartX + x, areaStartZ + z)
			if (!canPlaceBuilding)
				return

			const y = game.world.getHighestBlockHeightSafe(areaStartX + x, areaStartZ + z)
			if (y < 0)
				return

			if (previousY !== -1 && previousY !== y)
				return
			if (previousY === -1)
				previousY = y
		}
	}

	for (let x = 0; x < building.maskSizeX; x++)
		for (let z = 0; z < building.maskSizeZ; z++) {
			const computedX = areaStartX + x
			const computedZ = areaStartZ + z
			for (let y = previousY + 1, l = game.world.size.sizeY; y < l; y++)
				game.world.setBlock(computedX, y, computedZ, AIR_ID)
			for (let y = 0; y <= previousY; y++)
				game.world.setBlock(computedX, y, computedZ, BlockId.Stone)

			game.tileMetaDataIndex.setBuildingPlacedAt(computedX, computedZ)
		}


	const entities = game.entities
	const traits = EntityTrait.Position | EntityTrait.BuildingData
	const entity = entities.createEntity(traits)

	entities.positions.rawData[entity.position + DataOffsetPositions.PositionX] = centerX
	entities.positions.rawData[entity.position + DataOffsetPositions.PositionY] = previousY + 1
	entities.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = centerZ
	entities.buildingData.rawData[entity.buildingData + DataOffsetBuildingData.TypeId] = type
	entities.buildingData.rawData[entity.buildingData + DataOffsetBuildingData.ProgressPointsToFull] = building.pointsToFullyBuild

	game.metaData[MetadataField.LastWorldChange]++
	game.metaData[MetadataField.LastBuildingsChange]++

	return entity.thisId
}

const handlePickBlock = (result: MousePickerTerrainResult, event: EventHappened, game: GameState) => {
	switch (event) {
		case EventHappened.LeftClick:
			spawnBuilding(game, result.x, result.z, BuildingId.Monument)
			// game.world.setBlock(result.x + result.normals[0], result.y + result.normals[1], result.z + result.normals[2], BlockId.Gravel)
			break
		case EventHappened.RightClick:
			game.world.setBlock(result.x, result.y, result.z, BlockId.Air)
			break
	}
}

export default createInputReactor
