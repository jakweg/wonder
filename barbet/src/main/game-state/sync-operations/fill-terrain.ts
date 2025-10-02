import { GameState, MetadataField } from '@game'
import { BlockId } from '../world/block'

interface Props {
  game: GameState
  x: number
  z: number
  sx: number
  sz: number
  fillWith: BlockId
  replace?: BlockId
}

export default (props: Props): void => {
  const world = props.game.world

  const fillWith = props.fillWith
  const replace = props.replace

  for (let x = props.x, tx = props.x + props.sx; x < tx; x++)
    for (let z = props.z, tz = props.z + props.sz; z < tz; z++)
      if (replace !== undefined) world.replaceBlock2d(x, z, fillWith, replace)
      else world.setBlock(x, z, fillWith)

  props.game.metaData[MetadataField.LastWorldChange]!++
}
