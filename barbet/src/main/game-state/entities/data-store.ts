import TypedArray, { TypedArrayConstructor } from "@seampan/typed-array"

const DEFAULT_STORE_CAPACITY = 10
const RESIZE_FACTOR = 1.5

export interface ArrayAllocator {
	create<T extends TypedArray>(initialCapacity: number, constructor: TypedArrayConstructor<T>): T

	resize<T extends TypedArray>(old: T, resizeTo: number, constructor: TypedArrayConstructor<T>): T
}

export class DataStore<T extends TypedArray> {

	protected constructor(
		private countsArray: Uint32Array,
		private readonly allocator: ArrayAllocator,
		private readonly singleSize: number,
		private readonly arrayConstructor: TypedArrayConstructor<T>,
	) {
		this._rawData = allocator.create(DEFAULT_STORE_CAPACITY * singleSize, this.arrayConstructor)
	}

	public get size(): number {
		return this.countsArray[0]!
	}

	private _rawData: T

	public get rawData(): T {
		return this._rawData
	}

	public static create<T extends TypedArray>(countsArray: Uint32Array,
		allocator: ArrayAllocator,
		singleSize: number,
		constructor: TypedArrayConstructor<T>) {
		return new DataStore(countsArray, allocator, singleSize, constructor)
	}

	public replaceInternalsUnsafe(countsArray: Uint32Array) {
		this.countsArray = countsArray
		this._rawData = this.allocator.create(-1, this.arrayConstructor)
	}

	public pushBack(): number {
		const oldRawData = this._rawData
		const currentElementsCount = this.countsArray[0]++
		const newElementIndex = currentElementsCount * this.singleSize
		const currentCapacity = oldRawData.length
		if (newElementIndex + this.singleSize >= currentCapacity) {
			// need resize
			const newCapacityInBytes = Math.ceil(currentCapacity * RESIZE_FACTOR) | 0
			this._rawData = this.allocator.resize(oldRawData as any, newCapacityInBytes, this.arrayConstructor)
		}
		return newElementIndex
	}

}
