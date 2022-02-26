import { Direction } from '../../util/direction'
import { findPathDirectionsExact } from '../../util/path-finder'
import { World } from '../world/world'
import { GameState } from './game-state'

interface PathRequest {
	id: number
	fromX: number
	fromZ: number
	toX: number
	toZ: number
}

interface PathResult {
	computedAt: number
	found: boolean
	directions: Direction[]
}

export class PathFinder {
	private readonly readyPaths = new Map<number, PathResult>()
	private readonly pathQueue: PathRequest[] = []
	private nextPathRequestId: number = 0

	private constructor(private readonly world: World) {
	}

	public static createNewQueue(world: World) {
		return new PathFinder(world)
	}

	public tick(game: GameState) {
		const now = game.currentTick
		const clearOlderThen = now - 5_000

		for (let [id, value] of [...this.readyPaths.entries()]) {
			if (value.computedAt < clearOlderThen)
				this.readyPaths.delete(id)
		}

		for (const req of this.pathQueue) {
			const directions = findPathDirectionsExact(req.fromX, req.fromZ, req.toX, req.toZ,
				(x, z) => {
					return this.world.getHighestBlockHeight(x, z) === 1
				})
			let object
			if (directions == null)
				object = {
					computedAt: now,
					found: false,
					directions: [],
				}
			else object = {
				computedAt: now,
				found: true,
				directions: directions,
			}
			this.readyPaths.set(req.id, object)
		}
		this.pathQueue.splice(0)
	}

	public getComputedPath(id: number): PathResult | undefined {
		return this.readyPaths.get(id)
	}

	public requestPath(fromX: number, fromZ: number,
	                   toX: number, toZ: number): number {
		const req: PathRequest = {fromX, fromZ, toX, toZ, id: this.nextPathRequestId++}
		this.pathQueue.push(req)
		return req.id
	}
}
