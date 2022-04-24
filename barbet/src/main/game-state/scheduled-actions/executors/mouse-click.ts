import { MousePickableType, MousePickerResultAny, MousePickerTerrainResult } from '../../../3d-stuff/mouse-picker'
import { BuildingId, getBuildingMask, getBuildingProgressInfo } from '../../buildings'
import { DataOffsetBuildingData, DataOffsetPositions, EntityTrait } from '../../entities/traits'
import { GameState, MetadataField } from '../../game-state'
import { AIR_ID, BlockId } from '../../world/block'
import { ScheduledActionId } from '../index'

export type Action = {
	type: ScheduledActionId.MouseClick
	pick: MousePickerResultAny
	wasLeftClick: boolean
}

export const execute = (action: Action, game: GameState) => {
	const pick = action.pick

	switch (pick.pickedType) {
		case MousePickableType.Terrain:
			handlePickBlock(pick, action.wasLeftClick, game)
			break
	}
}

export const spawnBuilding = (game: GameState, centerX: number, centerZ: number, type: BuildingId) => {
	const mask = getBuildingMask(type)
	if (mask === null) return
	const progressInfo = getBuildingProgressInfo(type)
	if (progressInfo === null) return

	const areaStartX = centerX - (mask.sizeX / 2 | 0)
	const areaStartZ = centerZ - (mask.sizeZ / 2 | 0)

	let previousY = -1
	for (let x = 0; x < mask.sizeX; x++) {
		for (let z = 0; z < mask.sizeZ; z++) {
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

	for (let x = 0; x < mask.sizeX; x++)
		for (let z = 0; z < mask.sizeZ; z++) {
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
	entities.buildingData.rawData[entity.buildingData + DataOffsetBuildingData.ProgressPointsToFull] = progressInfo.pointsToFullyBuild

	game.metaData[MetadataField.LastWorldChange]++
	game.metaData[MetadataField.LastBuildingsChange]++

	return entity.thisId
}

const handlePickBlock = (result: MousePickerTerrainResult, wasLeftClick: boolean, game: GameState) => {
	if (wasLeftClick)
		spawnBuilding(game, result.x, result.z, BuildingId.Monument)
	else {
		game.world.setBlock(result.x, result.y, result.z, BlockId.Air)
		game.metaData[MetadataField.LastWorldChange]++
	}
}
