import { createNewBuffer, sharedMemoryIsAvailable } from './shared-memory'

type WaitAsyncResult = {
	async: boolean
	value: Promise<'ok' | 'not-equal' | 'timed-out'>
}

interface Additional extends Atomics {
	waitAsync(typedArray: Int32Array, index: number, value: number, timeout?: number): WaitAsyncResult
}

declare var Atomics: Additional

export const isInWorker = !location.reload
const useNativeWaitAsync: boolean = !!Atomics.waitAsync && sharedMemoryIsAvailable

export const waitAsyncCompat = useNativeWaitAsync ?
	Atomics.waitAsync : ((typedArray: Int32Array, index: number, value: number, timeout?: number): WaitAsyncResult => {
		const load = Atomics.load(typedArray, index)
		if (load !== value)
			return { 'async': false, 'value': Promise.resolve('ok') }

		const timeoutValue = timeout ?? Number.POSITIVE_INFINITY
		const started = performance.now()
		return {
			'async': true,
			'value': new Promise(resolve => {
				const interval = setInterval(() => {
					const load = Atomics.load(typedArray, index)
					if (load !== value) {
						resolve('ok')
						clearInterval(interval)
					}
					if (timeoutValue < performance.now() - started) {
						resolve('timed-out')
						clearInterval(interval)
					}
				}, 10)
			}),
		}
	})


export const enum Lock {
	Update,
	SIZE,
}

export const enum LockValue {
	Unlocked,
	Locked,
}

interface Mutex {
	pass(): unknown

	enter(lock: Lock, timeout?: number): boolean

	unlock(lock: Lock): void

	enterAsync(lock: Lock, timeout?: number): Promise<boolean>
}

export const createNewMutex = (): Mutex => {
	if (sharedMemoryIsAvailable)
		return new MutexImpl(createNewBuffer(Lock.SIZE * Int32Array.BYTES_PER_ELEMENT))
	else {
		// return some dummy mutex interface, shared memory is not available anyway
		return createDummyMutex()
	}
}

export const createMutexFromReceived = (object: any): Mutex => {
	const buffer = object.buffer as SharedArrayBuffer
	if (buffer === undefined)
		return createDummyMutex()
	if (buffer?.byteLength !== Lock.SIZE * Int32Array.BYTES_PER_ELEMENT)
		throw new Error(`Received invalid object`)

	return new MutexImpl(buffer)
}

const createDummyMutex = (): Mutex => ({
	unlock() {
	},
	enterAsync(): Promise<boolean> {
		return Promise.resolve(true)
	},
	enter(): boolean {
		return true
	},
	pass(): unknown {
		return {}
	},
})

class MutexImpl implements Mutex {
	private readonly intArray = new Int32Array(this.buffer)

	constructor(
		private readonly buffer: SharedArrayBuffer,
	) {
	}

	public pass(): unknown {
		return {
			buffer: this.buffer,
		}
	}

	public enter(lock: Lock, timeout?: number): boolean {
		const array = this.intArray
		while (true) {
			const oldValue = Atomics.compareExchange(array, lock,
				LockValue.Unlocked, LockValue.Locked)! as LockValue

			if (oldValue === LockValue.Unlocked)
				return true

			if (Atomics.wait(array, lock, LockValue.Locked, timeout) === 'timed-out') {
				throw new Error(`Lock timeout ${lock}`)
				// return false
			}
		}
	}

	public unlock(lock: Lock): void {
		const array = this.intArray
		Atomics.store(array, lock, LockValue.Unlocked)
		Atomics.notify(array, lock)
	}

	public async enterAsync(lock: Lock, timeout?: number) {
		const array = this.intArray
		while (true) {
			const oldValue = Atomics.compareExchange(array, lock,
				LockValue.Unlocked, LockValue.Locked)! as LockValue

			if (oldValue === LockValue.Unlocked)
				return true

			const wait = waitAsyncCompat(array, lock, LockValue.Locked, timeout)
			if (wait.async) {
				if (await wait['value'] === 'timed-out') {
					throw new Error(`Lock timeout ${lock}`)
					// return false
				}
			}
		}
	}
}

export default Mutex
