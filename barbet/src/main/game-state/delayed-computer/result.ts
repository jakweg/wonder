import { Direction } from '../../util/direction'
import { RequestType } from './request'

export interface PathResult {
	readonly type: RequestType.FindPath
	readonly found: boolean
	readonly directions: readonly Direction[]
}

export interface ItemResult {
	readonly type: RequestType.FindItem
	readonly found: boolean
	readonly foundAtX: number
	readonly foundAtZ: number
}

export type Result = { readonly id: number } & (PathResult | ItemResult)

export const encode = (res: Result, destination: Int32Array, offset: number): number => {
	const initialOffset = offset

	destination[offset++] = res.type
	destination[offset++] = res.id
	switch (res.type) {
		case RequestType.FindPath: {
			destination[offset++] = res.found ? 1 : 0
			destination[offset++] = res.directions.length
			for (const dir of res.directions)
				destination[offset++] = dir
			break
		}
		case RequestType.FindItem: {
			destination[offset++] = res.found ? 1 : 0
			destination[offset++] = res.foundAtX
			destination[offset++] = res.foundAtZ
			break
		}
	}
	return offset - initialOffset
}

export const decode = (source: Int32Array, offset: number): [Result, number] => {
	const initialOffset = offset
	let object: Result

	const type = source[offset++]!
	const id = source[offset++]!

	switch (type) {
		case RequestType.FindPath: {
			const found = source[offset++]! === 1
			const directionsLength = source[offset++]!
			const directions = [...new Array(directionsLength)].map(() => source[offset++]!)
			object = {
				id, type,
				found: found,
				directions,
			}
			break
		}
		case RequestType.FindItem: {
			const found = source[offset++]! === 1
			object = {
				id, type, found,
				foundAtX: source[offset++]!,
				foundAtZ: source[offset++]!,
			}
			break
		}
		default:
			throw new Error()
	}
	return [object, offset - initialOffset]
}
