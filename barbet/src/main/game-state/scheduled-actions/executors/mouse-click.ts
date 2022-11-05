import { MousePickableType, MousePickerResultAny, MousePickerTerrainResult } from '../../../3d-stuff/pipeline/mouse-picker'
import { BuildingId } from '../../buildings'
import { GameState, MetadataField } from '../../game-state'
import placeBuilding from '../../sync-operations/place-building'
import { BlockId } from '../../world/block'
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


const handlePickBlock = (result: MousePickerTerrainResult, wasLeftClick: boolean, game: GameState) => {
	if (wasLeftClick)
		placeBuilding({
			game,
			centerX: result.x,
			centerZ: result.z,
			type: BuildingId.Monument,
		})
	else {
		if (game.world.getBlock(result.x, result.y, result.z) !== BlockId.Water) {
			game.world.setBlock(result.x, result.y, result.z, BlockId.Air)
			game.metaData[MetadataField.LastWorldChange]++
		}
	}
}
