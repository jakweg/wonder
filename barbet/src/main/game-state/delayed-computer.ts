import { Direction } from '../util/direction'
import { findPathDirectionsToArea } from '../util/path-finder'
import { GameState } from './game-state'
import { ItemType } from './world/item'

const EMPTY_LIST = Object.freeze([] as Direction[])

export const enum RequestType {
	FindPath,
	FindItem,
}

export interface PathRequest {
	readonly type: RequestType.FindPath
	readonly startX: number
	readonly startZ: number
	readonly destinationXCenter: number
	readonly destinationZCenter: number
	readonly destinationXMin: number
	readonly destinationXMax: number
	readonly destinationZMin: number
	readonly destinationZMax: number
}

interface ItemRequest {
	readonly type: RequestType.FindItem
	readonly searchCenterX: number
	readonly searchCenterZ: number
	readonly filterType: ItemType
}

type Request = { readonly id: number } & (PathRequest | ItemRequest)

export interface PathResult {
	readonly found: boolean
	readonly directions: readonly Direction[]
}

export interface ItemResult {
	readonly found: boolean
	readonly foundAtX: number
	readonly foundAtZ: number
}

type Result = PathResult | ItemResult

export interface DelayedComputer {
	tick(game: GameState): void

	serialize(): unknown

	request(request: Request): number

	getResult(requestId: number): Result | null
}

class DelayedComputerImpl implements DelayedComputer {
	constructor(
		private nextRequestId: number,
		private readonly requestsQueue: Request[],
		private readonly results: Map<number, Result>,
	) {
	}


	public request(request: Request): number {
		const id = this.nextRequestId++
		this.requestsQueue.push({...request, id})
		return id
	}

	public getResult(requestId: number): Result | null {
		return this.results.get(requestId) ?? null
	}

	public tick(game: GameState): void {
		const requestsCount = this.requestsQueue.length
		for (let i = 0; i < requestsCount; i++) {
			const request = this.requestsQueue.shift()!

			let result: Result | null = null
			switch (request.type) {
				case RequestType.FindPath:
					result = handlePathRequest(request, game)
					break
				case RequestType.FindItem:
					result = handleItemRequest(request, game)
					break
				default:
					throw new Error()
			}
			this.results.set(request.id, result)
		}
	}

	public serialize(): unknown {
		return {
			'nextRequestId': this.nextRequestId,
			'requestsQueue': JSON.parse(JSON.stringify(this.requestsQueue)),
			'results': JSON.parse(JSON.stringify([...this.requestsQueue.entries()])),
		}
	}
}


const handlePathRequest = (req: PathRequest, game: GameState): Result => {
	const directions = findPathDirectionsToArea(req, game.tileMetaDataIndex.walkableTester)

	if (directions === null)
		return {found: false, directions: EMPTY_LIST}
	else
		return {found: true, directions: directions}
}

const handleItemRequest = (req: ItemRequest, game: GameState): Result => {
	const maxSizeToSearch = Math.max(game.world.size.sizeX, game.world.size.sizeZ)
	for (let i = 0; i < maxSizeToSearch; i++) {
		for (let x = req.searchCenterX - i, tx = req.searchCenterX + i; x <= tx; x++) {
			for (let z = req.searchCenterZ - i, tz = req.searchCenterZ + i; z < tz; z++) {
				const item = game.groundItems.getItem(x, z)
				if (item === req.filterType)
					return {
						found: true,
						foundAtX: x,
						foundAtZ: z,
					}
			}
		}
	}

	return {found: false, foundAtX: -1, foundAtZ: -1}
}

export const createNewDelayedComputer = (): DelayedComputer => {
	return new DelayedComputerImpl(1, [], new Map<number, Result>())
}


export const deserializeDelayedComputer = (object: any): DelayedComputer => {
	return new DelayedComputerImpl(
		object['nextRequestId'],
		object['requestsQueue'],
		new Map(object['results']),
	)
}



