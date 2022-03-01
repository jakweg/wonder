import { findPathDirectionsToArea } from '../../util/path-finder'
import { World } from '../world/world'
import { GameState } from './game-state'

interface PathRequest {
	id: number
	fromX: number
	fromZ: number
	toX: number
	toZ: number
	areaSize: number
}

interface PathResult {
	computedAt: number
	found: boolean
	directions: Uint8Array
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

		const tester = (x: number, z: number) => this.world.getHighestBlockHeight(x, z) === 1
		for (const req of this.pathQueue) {

			const directions = findPathDirectionsToArea(req.fromX, req.fromZ, req.toX, req.toZ, req.areaSize, tester)

			let object
			if (directions == null)
				object = {
					computedAt: now,
					found: false,
					directions: new Uint8Array(0),
				}
			else object = {
				computedAt: now,
				found: true,
				directions: new Uint8Array(directions),
			}
			this.readyPaths.set(req.id, object)
		}
		this.pathQueue.splice(0)
	}

	public getComputedPath(id: number): PathResult | undefined {
		return this.readyPaths.get(id)
	}

	public requestPath(fromX: number, fromZ: number,
	                   toX: number, toZ: number,
	                   areaSize: number): number {
		const req: PathRequest = {areaSize, fromX, fromZ, toX, toZ, id: this.nextPathRequestId++}
		this.pathQueue.push(req)
		return req.id
	}
}
