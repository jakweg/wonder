import { GameState } from '@game'
import { ArrayEncodingType, setArrayEncodingType } from '@utils/persistance/serializers'
import { ScheduledActionId } from '../../'
import { computeWorldBoundingBox } from '../../../world/bounding-box'
import { World } from '../../../world/world'

export type Action = {
  type: ScheduledActionId.DebugCreateBuildingPrototype
}

export const execute = (_: Action, game: GameState) => {
  const world = game.world
  const box = computeWorldBoundingBox(world)

  const newOne = World.createEmpty(box.maxX - box.minX + 1, box.maxY - box.minY, box.maxZ - box.minZ + 1)

  World.copyFragment(
    world,
    newOne,
    box.minX,
    box.minY,
    box.minZ,
    0,
    0,
    0,
    newOne.size.sizeX,
    newOne.size.sizeY,
    newOne.size.sizeZ,
  )

  setArrayEncodingType(ArrayEncodingType.String)
  console.log(newOne.serialize())
  setArrayEncodingType(ArrayEncodingType.None)
}
