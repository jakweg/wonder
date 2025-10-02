import { GameState, MetadataField } from '@game'
import { BuildingId, getBuildingMask, getBuildingProgressInfo } from '../buildings'
import { DataOffsetBuildingData, DataOffsetPositions } from '../entities/data-offsets'
import { EntityTrait } from '../entities/traits'
import { AIR_ID, BlockId } from '../world/block'

interface Props {
  game: GameState
  centerX: number
  centerZ: number
  type: BuildingId
}

export const enum ErrorReason {
  InvalidType,
  OccupiedTile,
  NotPlainTerrain,
}

export type Result = { success: true; entityId: number } | { success: false; reason: ErrorReason }

export default ({ type, game, centerX, centerZ }: Props): Result => {
  const mask = getBuildingMask(type)
  if (mask === null) return { success: false, reason: ErrorReason.InvalidType }

  const progressInfo = getBuildingProgressInfo(type)
  if (progressInfo === null) return { success: false, reason: ErrorReason.InvalidType }

  const areaStartX = centerX - ((mask.sizeX / 2) | 0)
  const areaStartZ = centerZ - ((mask.sizeZ / 2) | 0)

  let previousY = -1
  for (let x = 0; x < mask.sizeX; x++) {
    for (let z = 0; z < mask.sizeZ; z++) {
      const canPlaceBuilding = game.tileMetaDataIndex.canPlaceBuilding(areaStartX + x, areaStartZ + z)
      if (!canPlaceBuilding) return { success: false, reason: ErrorReason.OccupiedTile }

      const y = game.world.getHighestBlockHeightSafe(areaStartX + x, areaStartZ + z)

      if (previousY !== -1 && previousY !== y) return { success: false, reason: ErrorReason.NotPlainTerrain }

      if (previousY === -1) previousY = y
    }
  }

  for (let x = 0; x < mask.sizeX; x++)
    for (let z = 0; z < mask.sizeZ; z++) {
      const computedX = areaStartX + x
      const computedZ = areaStartZ + z
      game.world.setBlock(computedX, computedZ, BlockId.Stone)

      game.tileMetaDataIndex.setBuildingPlacedAt(computedX, computedZ)
    }

  const entities = game.entities
  const traits = EntityTrait.Position | EntityTrait.BuildingData
  const entity = entities.createEntity(traits)

  entities.positions.rawData[entity.position + DataOffsetPositions.PositionX] = centerX
  entities.positions.rawData[entity.position + DataOffsetPositions.PositionY] = previousY + 1
  entities.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = centerZ
  entities.buildingData.rawData[entity.buildingData + DataOffsetBuildingData.TypeId] = type
  entities.buildingData.rawData[entity.buildingData + DataOffsetBuildingData.ProgressPointsToFull] =
    progressInfo.pointsToFullyBuild

  game.metaData[MetadataField.LastWorldChange]!++
  game.metaData[MetadataField.LastBuildingsChange]!++

  return { success: true, entityId: entity.thisId }
}
