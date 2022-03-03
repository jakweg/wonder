const DEFAULT_STORE_CAPACITY = 10
const RESIZE_FACTOR = 1.5

export interface ArrayAllocator<T> {
	create(initialCapacity: number): T

	resize(old: T, resizeTo: number): T
}

export class DataStore<T> {

	protected constructor(
		private readonly allocator: ArrayAllocator<T>,
		private readonly singleSize: number,
		private _capacity: number,
	) {
		this._rawData = allocator.create(_capacity * singleSize)
	}

	private _size: number = 0

	public get size(): number {
		return this._size
	}

	private _rawData: T

	public get rawData(): T {
		return this._rawData
	}

	public get capacity(): number {
		return this._capacity
	}

	public static create<T>(allocator: ArrayAllocator<T>, singleSize: number) {
		return new DataStore(allocator, singleSize, DEFAULT_STORE_CAPACITY)
	}

	public setSizeUnsafe(size: number, capacity: number): void {
		this._size = size
		this._capacity = capacity
	}

	public safeGetPointer(index: number): number {
		if (index < 0 || index >= this._size || (index | 0) !== index)
			throw new Error(`Invalid index ${index}`)

		return index * this.singleSize
	}

	public pushBack(): number {
		const oldIndex = this._size++
		if (oldIndex === this._capacity) {
			const newCapacity = Math.ceil(this._capacity * RESIZE_FACTOR) | 0
			this._capacity = newCapacity
			this._rawData = this.allocator.resize(this._rawData, newCapacity * this.singleSize | 0)
		}
		return oldIndex * this.singleSize
	}

}
