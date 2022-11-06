import { GameState } from '@game'
import { Direction } from '@utils/direction'
import * as idle from '../activities/idle'
import { DataOffsetDrawables, DataOffsetPositions, EntityTrait } from '../entities/traits'

interface Props {
  game: GameState
  x: number
  z: number
  color: any //UnitColorPaletteId
  facing?: Direction
}

const enum ErrorReason {
  CoordinatesOutOfBounds,
  InvalidHeightOfCoordinates,
}

type Result = { success: false; reason: ErrorReason } | { success: true; unitId: number }

const unitTraits =
  EntityTrait.Position |
  EntityTrait.Drawable |
  EntityTrait.ItemHoldable |
  EntityTrait.WithActivity |
  EntityTrait.Interruptible

export default (props: Props): Result => {
  const x = props.x
  const z = props.z

  if (
    x < 0 ||
    x >= props.game.world.size.sizeX ||
    x !== (x | 0) ||
    z < 0 ||
    z >= props.game.world.size.sizeZ ||
    z !== (z | 0)
  )
    return { success: false, reason: ErrorReason.CoordinatesOutOfBounds }

  const y = props.game.world.getHighestBlockHeight(x, z)
  if (y <= 0) return { success: false, reason: ErrorReason.InvalidHeightOfCoordinates }

  const entities = props.game.entities

  const unit = entities.createEntity(unitTraits)
  entities.positions.rawData[unit.position + DataOffsetPositions.PositionX] = x
  entities.positions.rawData[unit.position + DataOffsetPositions.PositionY] = y + 1
  entities.positions.rawData[unit.position + DataOffsetPositions.PositionZ] = z

  entities.drawables.rawData[unit.drawable + DataOffsetDrawables.ColorPaletteId] = props.color
  entities.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation] = props.facing ?? Direction.NegativeX

  idle.setup(props.game, unit)

  return { success: true, unitId: unit.thisId }
}
