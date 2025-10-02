import { GameState } from '@game'
import { ArrayEncodingType, setArrayEncodingType } from '@utils/persistence/serializers'
import { ScheduledActionId } from '../../'
import { computeWorldBoundingBox } from '../../../world/bounding-box'
import { World } from '../../../world/world'
import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from '@game/world/size'

export type Action = {
  type: ScheduledActionId.DebugCreateBuildingPrototype
}

export const execute = (_: Action, game: GameState) => {
  const world = game.world
  const box = computeWorldBoundingBox(world)

  const newOne = World.createEmpty(WorldSizeLevel.SuperTiny)

  World.copyFragment(
    world,
    newOne,
    box.minX,
    box.minZ,
    0,
    0,
    newOne.sizeLevel * GENERIC_CHUNK_SIZE,
    newOne.sizeLevel * GENERIC_CHUNK_SIZE,
  )

  setArrayEncodingType(ArrayEncodingType.String)
  console.log(newOne.serialize())
  setArrayEncodingType(ArrayEncodingType.None)
}
