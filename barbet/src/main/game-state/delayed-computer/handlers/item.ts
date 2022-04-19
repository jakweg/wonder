import { GameState } from '../../game-state'
import { ItemRequest, RequestType } from '../request'
import { ItemResult } from '../result'

export default (req: ItemRequest, game: GameState): ItemResult => {
	const maxSizeToSearch = Math.max(game.world.size.sizeX, game.world.size.sizeZ)
	for (let i = 0; i < maxSizeToSearch; i++) {
		for (let x = req.searchCenterX - i, tx = req.searchCenterX + i; x <= tx; x++) {
			for (let z = req.searchCenterZ - i, tz = req.searchCenterZ + i; z < tz; z++) {
				const item = game.groundItems.getItem(x, z)
				if (item === req.filterType)
					return {
						type: RequestType.FindItem,
						found: true,
						foundAtX: x,
						foundAtZ: z,
					}
			}
		}
	}

	return {
		type: RequestType.FindItem,
		found: false, foundAtX: -1, foundAtZ: -1,
	}
}
