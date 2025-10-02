import { ModelId } from '@3d/model/model-id'
import { GameStateImplementation } from '@game'
import { lockRotation, setColor, setRotation, setSize } from '@game/activities/slime/rotate-utils'
import { Direction } from '@utils/direction'
import * as slime_idle from '../activities/slime/idle'
import { DataOffsetDrawables, DataOffsetPositions } from '../entities/data-offsets'
import { EntityTrait } from '../entities/traits'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'

interface Props {
  game: GameStateImplementation
  x: number
  z: number
  facing?: Direction
  size?: number
  color?: number
}

const enum ErrorReason {
  CoordinatesOutOfBounds,
  InvalidHeightOfCoordinates,
}

type Result = { success: false; reason: ErrorReason } | { success: true; unitId: number }

const unitTraits = EntityTrait.Position | EntityTrait.Drawable | EntityTrait.WithActivity

export default (props: Props): Result => {
  const x = props.x
  const z = props.z

  const blocksPerAxis = props.game.world.sizeLevel * GENERIC_CHUNK_SIZE

  if (x < 0 || x >= blocksPerAxis || x !== (x | 0) || z < 0 || z >= blocksPerAxis || z !== (z | 0))
    return { success: false, reason: ErrorReason.CoordinatesOutOfBounds }

  const y = props.game.world.getHighestBlockHeight(x, z)
  if (y <= 0) return { success: false, reason: ErrorReason.InvalidHeightOfCoordinates }

  const entities = props.game.entities

  const unit = entities.createEntity(unitTraits)
  entities.positions.rawData[unit.position + DataOffsetPositions.PositionX] = x
  entities.positions.rawData[unit.position + DataOffsetPositions.PositionY] = y + 1
  entities.positions.rawData[unit.position + DataOffsetPositions.PositionZ] = z

  entities.drawables.rawData[unit.drawable + DataOffsetDrawables.ModelId] = ModelId.Slime_Idle
  setRotation(props.game, unit, props.facing ?? Direction.NegativeX)
  lockRotation(props.game, unit)
  setSize(props.game, unit, props.size ?? 1)
  setColor(props.game, unit, props.color ?? 0x00ffff)

  slime_idle.setup(props.game, unit)

  return { success: true, unitId: unit.thisId }
}
