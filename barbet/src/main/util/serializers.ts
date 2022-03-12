import { createNewBuffer } from './shared-memory'

type ArrayToEncode = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array

export const encodeArray = (array: ArrayToEncode): string => {
	return btoa(String.fromCharCode(...new Uint8Array(array.buffer)))
}

export const decodeArray = <T>(data: string, makeShared: boolean, constructor: { new(b: ArrayBufferLike): T }): T => {
	data = atob(data)

	const length = data.length
	const buffer = makeShared ? createNewBuffer(length) : new ArrayBuffer(length)

	const array = new Uint8Array(buffer)
	for (let i = 0; i < length; i++)
		array[i] = data.charCodeAt(i)

	// @ts-ignore
	return Uint8Array === constructor ? array : (new constructor(buffer))
}

