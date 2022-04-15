import { createNewBuffer } from '../shared-memory'

type ArrayToEncode = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array

export const enum ArrayEncodingType {
	None,
	String,
	Array,
}

let currentEncodingType: ArrayEncodingType = ArrayEncodingType.None
export const setArrayEncodingType = (type: ArrayEncodingType) => {
	currentEncodingType = type
}

export const encodeArray = (array: ArrayToEncode): unknown => {
	switch (currentEncodingType) {
		case ArrayEncodingType.None:
			throw new Error()
		case ArrayEncodingType.String:
			return btoa(String.fromCharCode(...new Uint8Array(array['buffer'])))
		case ArrayEncodingType.Array: {
			const fromArray = new Uint8Array(array['buffer'])
			const length = fromArray.length
			const copy = new Uint8Array(length)
			for (let i = 0; i < length; i++)
				copy[i] = fromArray[i]!
			return copy
		}
	}
}

export const decodeArray = <T>(data: any, makeShared: boolean, constructor: { new(b: ArrayBufferLike): T }): T => {
	switch (currentEncodingType) {
		case ArrayEncodingType.None:
			throw new Error()
		case ArrayEncodingType.String: {
			data = atob(data)
			const length = data.length
			const buffer = makeShared ? createNewBuffer(length) : new ArrayBuffer(length)

			const array = new Uint8Array(buffer)
			for (let i = 0; i < length; i++)
				array[i] = data.charCodeAt(i)

			// @ts-ignore
			return Uint8Array === constructor ? array : (new constructor(buffer))
		}
		case ArrayEncodingType.Array: {
			const length = data.length
			const buffer = makeShared ? createNewBuffer(length) : new ArrayBuffer(length)

			const array = new Uint8Array(buffer)
			for (let i = 0; i < length; i++)
				array[i] = data[i]!

			// @ts-ignore
			return Uint8Array === constructor ? array : (new constructor(buffer))
		}
	}
}

