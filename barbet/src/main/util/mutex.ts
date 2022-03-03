type WaitAsyncResult = { async: false } | {
	async: true
	value: Promise<'ok' | 'not-equal' | 'timed-out'>
}

interface Additional extends Atomics {
	waitAsync(typedArray: Int32Array, index: number, value: number, timeout?: number): WaitAsyncResult
}

declare var Atomics: Additional

export const waitAsyncCompat = Atomics.waitAsync ?? ((typedArray: Int32Array, index: number, value: number): WaitAsyncResult => {
	const load = Atomics.load(typedArray, index)
	if (load !== value)
		return {async: false}

	return {
		async: true,
		value: new Promise(resolve => {
			const interval = setInterval(() => {
				const load = Atomics.load(typedArray, index)
				if (load !== value) {
					resolve('ok')
					clearInterval(interval)
				}
			}, 5)
		}),
	}
})

export const enum Lock {
	Update,
	StateUpdaterStatus,
	FrontedVariables,
	SIZE,
}

export const enum LockValue {
	Unlocked,
	Locked,
}

class Mutex {
	private readonly intArray = new Int32Array(this.buffer)

	private constructor(
		private readonly buffer: SharedArrayBuffer,
	) {
	}

	public static createNew() {
		return new Mutex(
			new SharedArrayBuffer(Lock.SIZE * Int32Array.BYTES_PER_ELEMENT),
		)
	}

	public static fromReceived(object: any) {
		if (typeof object !== 'object' || object['type'] !== 'mutex')
			throw new Error(`Received invalid mutex`)

		const buffer = object['buffer'] as SharedArrayBuffer
		if (buffer?.byteLength !== Lock.SIZE * Int32Array.BYTES_PER_ELEMENT)
			throw new Error(`Received invalid mutex`)

		return new Mutex(buffer)
	}

	public pass(): unknown {
		return {
			type: 'mutex',
			buffer: this.buffer,
		}
	}

	public executeWithAcquired(
		lock: Lock,
		func: () => void): void {

		const array = this.intArray
		while (true) {
			const oldValue = Atomics.compareExchange(array, lock,
				LockValue.Unlocked, LockValue.Locked)! as LockValue

			if (oldValue === LockValue.Unlocked) {
				try {
					func()
				} finally {
					Atomics.store(array, lock, LockValue.Unlocked)
					Atomics.notify(array, lock)
				}
				return
			}
			Atomics.wait(array, lock, LockValue.Locked)
		}
	}

	public async executeWithAcquiredAsync(
		lock: Lock,
		func: (() => (void | Promise<void>))): Promise<void> {

		const array = this.intArray
		while (true) {
			const oldValue = Atomics.compareExchange(array, lock,
				LockValue.Unlocked, LockValue.Locked)! as LockValue

			if (oldValue === LockValue.Unlocked) {
				try {
					await func()
				} finally {
					Atomics.store(array, lock, LockValue.Unlocked)
					Atomics.notify(array, lock)
				}
				return
			}
			const wait = waitAsyncCompat(array, lock, LockValue.Locked)
			if (wait.async)
				await wait.value
		}
	}
}

export default Mutex
