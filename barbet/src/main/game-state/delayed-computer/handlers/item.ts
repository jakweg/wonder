import { GameState } from '../../game-state'
import { ItemRequest, RequestType } from '../request'
import { ItemResult } from '../result'

export default (req: ItemRequest, game: GameState): ItemResult => {
  const maxSizeToSearch = Math.max(game.world.size.sizeX, game.world.size.sizeZ)
  for (let tilesDistance = 1; tilesDistance < maxSizeToSearch; tilesDistance++) {
    let x = req.searchCenterX - tilesDistance
    for (let z = req.searchCenterZ - tilesDistance, tz = req.searchCenterZ + tilesDistance; z <= tz; z++) {
      const item = game.groundItems.getItem(x, z)
      if (item === req.filterType)
        return {
          type: RequestType.FindItem,
          found: true,
          foundAtX: x,
          foundAtZ: z,
        }
    }
    x = req.searchCenterX + tilesDistance
    for (let z = req.searchCenterZ - tilesDistance, tz = req.searchCenterZ + tilesDistance; z <= tz; z++) {
      const item = game.groundItems.getItem(x, z)
      if (item === req.filterType)
        return {
          type: RequestType.FindItem,
          found: true,
          foundAtX: x,
          foundAtZ: z,
        }
    }

    for (let x = req.searchCenterX - tilesDistance + 1, tx = req.searchCenterX + tilesDistance; x < tx; x++) {
      let z = req.searchCenterZ - tilesDistance
      let item = game.groundItems.getItem(x, z)
      if (item === req.filterType)
        return {
          type: RequestType.FindItem,
          found: true,
          foundAtX: x,
          foundAtZ: z,
        }

      z = req.searchCenterZ + tilesDistance
      item = game.groundItems.getItem(x, z)
      if (item === req.filterType)
        return {
          type: RequestType.FindItem,
          found: true,
          foundAtX: x,
          foundAtZ: z,
        }
    }
  }

  return {
    type: RequestType.FindItem,
    found: false,
    foundAtX: -1,
    foundAtZ: -1,
  }
}
