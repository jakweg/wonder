import TypedArray, { TypedArrayConstructor } from "@seampan/typed-array"

const DEFAULT_STORE_CAPACITY = 100000 + 2
const RESIZE_FACTOR = 1.5

export interface ArrayAllocator {
	create<T extends TypedArray>(initialCapacity: number, constructor: TypedArrayConstructor<T>): T

	resize<T extends TypedArray>(old: T, resizeTo: number, constructor: TypedArrayConstructor<T>): T
}

export class DataStore<T extends TypedArray> {

	protected constructor(
		private readonly allocator: ArrayAllocator,
		private readonly singleSize: number,
		private readonly arrayConstructor: TypedArrayConstructor<T>,
	) {
		this._rawData = allocator.create(DEFAULT_STORE_CAPACITY * singleSize + 1, this.arrayConstructor)
	}

	public get size(): number {
		return (this._rawData as any)[0]! as number
	}

	private _rawData: T

	public get rawData(): T {
		return this._rawData
	}

	public static create<T extends TypedArray>(allocator: ArrayAllocator, singleSize: number, constructor: TypedArrayConstructor<T>) {
		return new DataStore(allocator, singleSize, constructor)
	}

	public replaceInternalsUnsafe() {
		this._rawData = this.allocator.create(-1, this.arrayConstructor)
	}

	public pushBack(): number {
		const oldRawData = this._rawData as unknown as TypedArray
		const currentElementsCount = oldRawData[0]++
		const newElementIndex = currentElementsCount * this.singleSize + 1
		const currentCapacity = oldRawData.length
		if (newElementIndex + this.singleSize >= currentCapacity) {
			// need resize
			const newCapacityInBytes = Math.ceil((currentCapacity - 1) * RESIZE_FACTOR) | 0
			this._rawData = this.allocator.resize(oldRawData as any, 1 + newCapacityInBytes, this.arrayConstructor)
		}
		return newElementIndex
	}

}
