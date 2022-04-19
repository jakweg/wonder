import { EMPTY_LIST } from '../../../util/common'
import { findPathDirectionsToArea } from '../../../util/path-finder'
import { GameState } from '../../game-state'
import { PathRequest, RequestType } from '../request'
import { PathResult } from '../result'

export default (req: PathRequest, game: GameState): PathResult => {
	const directions = findPathDirectionsToArea(req, game.tileMetaDataIndex.walkableTester)

	if (directions === null)
		return {type: RequestType.FindPath, found: false, directions: EMPTY_LIST}
	else
		return {type: RequestType.FindPath, found: true, directions: directions}
}
