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
	) {
		this._rawData = allocator.create(DEFAULT_STORE_CAPACITY * singleSize + 1)
	}

	public get size(): number {
		return (this._rawData as any)[0]! as number
	}

	private _rawData: T

	public get rawData(): T {
		return this._rawData
	}

	public static create<T>(allocator: ArrayAllocator<T>, singleSize: number) {
		return new DataStore(allocator, singleSize)
	}

	public replaceInternalsUnsafe() {
		this._rawData = this.allocator.create(-1)
	}

	public pushBack(): number {
		const oldRawData = this._rawData as unknown as Int16Array
		const currentElementsCount = oldRawData[0]++
		const newElementIndex = currentElementsCount * this.singleSize + 1
		const currentCapacity = oldRawData.length
		if (newElementIndex === currentCapacity) {
			// need resize
			const newCapacityInBytes = Math.ceil((currentCapacity - 1) * RESIZE_FACTOR) | 0
			this._rawData = this.allocator.resize(oldRawData as any, 1 + newCapacityInBytes)
		}
		return newElementIndex
	}

}
