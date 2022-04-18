export const lazy = <T>(creator: () => T): () => T => {
	let initialized = false
	let value: T | null = null
	return () => {
		if (!initialized) {
			initialized = true
			value = creator()
		}
		return value!
	}
}
