import { findPathDirectionsToArea } from '../../../util/path-finder'
import { GameState } from '../../game-state'
import { PathRequest, RequestType } from '../request'
import { PathResult } from '../result'

const EMPTY_LIST: ReadonlyArray<any> = Object.freeze([])

export default (req: PathRequest, game: GameState): PathResult => {
	const y = game.world.getHighestBlockHeight(req.startX, req.startZ)

	const directions = findPathDirectionsToArea(req, game.tileMetaDataIndex.createWalkableTester(y + 1))

	if (directions === null)
		return {type: RequestType.FindPath, found: false, directions: EMPTY_LIST}
	else
		return {type: RequestType.FindPath, found: true, directions: directions}
}
