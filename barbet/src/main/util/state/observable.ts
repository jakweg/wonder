import State from './'

export type Observable<T> = (listener: ((newValue: T, oldValue: T | undefined) => void)) => void

export const observeField = <S, K extends keyof S>(state: State<S>, key: K): Observable<Readonly<S[K]>> => {
	const listeners: any[] = []
	let currentValue: Readonly<S[K]> | undefined = undefined
	state.observe(key, (value) => {
		for (let l of listeners)
			l(value, currentValue)
		currentValue = value
	})

	return (listener: (newValue: Readonly<S[K]>, oldValue: undefined | Readonly<S[K]>) => void) => {
		listeners.push(listener)
		listener(currentValue!, undefined)
	}
}

export const observableState = <T>(defaultValue: T): [Observable<T>, (updater: (value: T) => T) => void] => {
	const listeners: any[] = []
	let currentValue = defaultValue
	return [
		(listener) => {
			listeners.push(listener)
			listener(currentValue!, undefined)
		},
		(updater: (value: T) => T) => {
			const value = updater(currentValue)
			if (currentValue !== value) {
				for (let l of listeners)
					l(value, currentValue)
				currentValue = value
			}
		},
	]
}

export const constantState = <T>(value: T): Observable<T> => {
	return (listener) => listener(value, undefined)
}
