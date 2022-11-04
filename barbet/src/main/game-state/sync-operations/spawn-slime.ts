import ModelId from '../../3d-stuff/model/model-id'
import { Direction } from '../../util/direction'
import { DataOffsetDrawables, DataOffsetPositions, EntityTrait } from '../entities/traits'
import { GameState } from '../game-state'

interface Props {
	game: GameState
	x: number
	z: number
	facing?: Direction
}

const enum ErrorReason {
	CoordinatesOutOfBounds,
	InvalidHeightOfCoordinates,
}

type Result = { success: false, reason: ErrorReason } | { success: true, unitId: number }

const unitTraits = EntityTrait.Position | EntityTrait.Drawable

export default (props: Props): Result => {
	const x = props.x
	const z = props.z

	if (x < 0 || x >= props.game.world.size.sizeX || x !== (x | 0)
		|| z < 0 || z >= props.game.world.size.sizeZ || z !== (z | 0))
		return { success: false, reason: ErrorReason.CoordinatesOutOfBounds }

	const y = props.game.world.getHighestBlockHeight(x, z)
	if (y <= 0)
		return { success: false, reason: ErrorReason.InvalidHeightOfCoordinates }

	const entities = props.game.entities

	const unit = entities.createEntity(unitTraits)
	entities.positions.rawData[unit.position + DataOffsetPositions.PositionX] = x
	entities.positions.rawData[unit.position + DataOffsetPositions.PositionY] = y + 1
	entities.positions.rawData[unit.position + DataOffsetPositions.PositionZ] = z

	entities.drawables.rawData[unit.drawable + DataOffsetDrawables.ModelId] = ModelId.Slime
	entities.drawables.rawData[unit.drawable + DataOffsetDrawables.PoseId] = 0
	entities.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation] = props.facing ?? Direction.NegativeX

	return { success: true, unitId: unit.thisId }
}
