export const freezeAndValidateOptionsList = <T>(list: T[],
                                                indexGetter: (value: T) => number = (value) => (value as any)['numericId']!) => {
	Object.freeze(list)
	for (let i = 0, s = list.length; i < s; i++) {
		const item = list[i]!
		Object.freeze(item)
		const index = indexGetter(item)
		if (i !== index)
			throw new Error(`Object has invalid index property: expected ${i}, but got ${index}, object: ${JSON.stringify(item)}`)
	}
}

export const EMPTY_LIST: ReadonlyArray<any> = Object.freeze([])
