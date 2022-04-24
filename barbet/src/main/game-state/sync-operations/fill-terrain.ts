import { GameState, MetadataField } from '../game-state'
import { BlockId } from '../world/block'

interface Props {
	game: GameState
	x: number
	y: number
	z: number
	sx: number
	sy: number
	sz: number
	fillWith: BlockId
	replace?: BlockId
}

export default (props: Props): void => {
	const world = props.game.world

	const fillWith = props.fillWith
	const replace = props.replace

	for (let x = props.x, tx = props.x + props.sx; x < tx; x++)
		for (let y = props.y, ty = props.y + props.sy; y < ty; y++)
			for (let z = props.z, tz = props.z + props.sz; z < tz; z++)
				if (replace !== undefined)
					world.replaceBlock(x, y, z, fillWith, replace)
				else
					world.setBlock(x, y, z, fillWith)

	props.game.metaData[MetadataField.LastWorldChange]++
}
