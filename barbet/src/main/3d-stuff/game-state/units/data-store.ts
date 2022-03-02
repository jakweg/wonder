const DEFAULT_STORE_CAPACITY = 10
const RESIZE_FACTOR = 1.5

interface ArrayAllocator<T> {
	create(initialCapacity: number): T

	resize(old: T, resizeTo: number): T
}

export const int32Allocator: ArrayAllocator<Int32Array> = {
	create(initialCapacity: number): Int32Array {
		return new Int32Array(initialCapacity)
	},
	resize(old: Int32Array, newSize: number): Int32Array {
		const newArray = new Int32Array(newSize)
		for (let i = 0, l = old.length; i < l; ++i)
			newArray[i] = old[i]!

		return newArray
	},
}

export const float32Allocator: ArrayAllocator<Float32Array> = {
	create(initialCapacity: number): Float32Array {
		return new Float32Array(initialCapacity)
	},
	resize(old: Float32Array, newSize: number): Float32Array {
		const newArray = new Float32Array(newSize)
		for (let i = 0, l = old.length; i < l; ++i)
			newArray[i] = old[i]!

		return newArray
	},
}

export class DataStore<T> {

	protected constructor(
		private readonly allocator: ArrayAllocator<T>,
		private readonly singleSize: number,
		private capacity: number,
	) {
		this._rawData = allocator.create(capacity * singleSize)
	}

	private _size: number = 0

	public get size(): number {
		return this._size
	}

	private _rawData: T

	public get rawData(): T {
		return this._rawData
	}

	public static createInt32(singleSize: number) {
		return new DataStore(int32Allocator, singleSize, DEFAULT_STORE_CAPACITY)
	}

	public static createFloat32(singleSize: number) {
		return new DataStore(float32Allocator, singleSize, DEFAULT_STORE_CAPACITY)
	}

	public safeGetPointer(index: number): number {
		if (index < 0 || index >= this._size || (index | 0) !== index)
			throw new Error(`Invalid index ${index}`)

		return index * this.singleSize
	}

	public pushBack(): number {
		const oldIndex = this._size++
		if (oldIndex === this.capacity) {
			const newCapacity = Math.ceil(this.capacity * RESIZE_FACTOR) | 0
			this.capacity = newCapacity
			this._rawData = this.allocator.resize(this._rawData, newCapacity * this.singleSize | 0)
		}
		return oldIndex * this.singleSize
	}

}
