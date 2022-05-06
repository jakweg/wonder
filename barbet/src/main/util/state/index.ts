export default class State<T> {
	private readonly listeners: Map<any, any[]> = new Map<any, any[]>()
	private readonly everythingListeners: any[] = []

	private constructor(
		private current: T,
	) {
	}

	public static fromInitial<T>(initial: T): State<T> {
		return new State<T>(Object.freeze(initial))
	}

	public pass(): Readonly<T> {
		return this.current
	}

	public get<K extends keyof T>(key: K): Readonly<T[K]> {
		return this.current[key]
	}


	public replace(entireState: T) {
		return this.update({...this.current, ...entireState})
	}


	public set<K extends keyof T>(key: K, value: T[K]): void {
		return this.update({[key]: value} as any)
	}

	public update(update: Partial<T>) {
		const listenersToCall: any[] = []
		const current = this.current
		for (const [key, newValue] of Object.entries(update)) {
			const oldValue = (current as any)[key]
			if (oldValue !== newValue) {
				const listeners = this.listeners.get(key)
				if (listeners)
					listenersToCall.push(...listeners.map(l => () => l(newValue)))
			}
		}
		const snapshot = this.current = {...current, ...update}
		for (const l of listenersToCall) l()
		for (const l of [...this.everythingListeners]) l(snapshot)
	}

	public observe<K extends keyof T>(key: K,
	                                  callback: (value: T[K]) => void,
	                                  initialCall: boolean = true): () => void {

		const value = this.current[key]
		let list = this.listeners.get(key)
		if (list === undefined) {
			list = []
			this.listeners.set(key, list)
		}
		if (initialCall)
			callback(value)
		list.push(callback)
		return () => {
			const index = list?.indexOf(callback) ?? -1
			if (index >= 0)
				list?.splice(index, 1)
		}
	}

	public observeEverything(callback: (snapshot: T) => void,
	                         initialCall: boolean = true): () => void {
		this.everythingListeners.push(callback)
		if (initialCall)
			callback(this.current)
		return () => {
			const index = this.everythingListeners.indexOf(callback) ?? -1
			if (index >= 0)
				this.everythingListeners.splice(index, 1)
		}
	}
}
