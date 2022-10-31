import { decodeArray, encodeArray } from '../../util/persistance/serializers'
import { createNewBuffer } from '../../util/shared-memory'
import { ArrayAllocator, DataStore } from './data-store'
import {
	createEmptyTraitRecord,
	DataOffsetBuildingData,
	DataOffsetDrawables,
	DataOffsetIds,
	DataOffsetInterruptible,
	DataOffsetItemHoldable,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTrait,
	EntityTraitIndicesRecord,
	hasTrait,
	initializeTraitsOfNewEntity,
	NO_INDEX
} from './traits'

export const ACTIVITY_MEMORY_SIZE = 20
type ArraysChangedNotifyCallback = () => void

interface ContainerAllocator<T> extends ArrayAllocator<T> {
	buffers: SharedArrayBuffer[]
	reuseCounter: number
	readonly notifyArraysChanged: ArraysChangedNotifyCallback
}

const createInt32Allocator = (buffers: SharedArrayBuffer[],
	notify: ArraysChangedNotifyCallback): ContainerAllocator<Int32Array> => ({
		buffers: buffers,
		reuseCounter: buffers.length,
		notifyArraysChanged: notify,
		create(initialCapacity: number): Int32Array {
			let buffer
			if (this.reuseCounter > 0) {
				buffer = this.buffers[this.buffers.length - this.reuseCounter]!
				this.reuseCounter--
			} else {
				buffer = createNewBuffer(initialCapacity * Int32Array.BYTES_PER_ELEMENT)
				this.buffers.push(buffer)
			}
			return new Int32Array(buffer)
		},
		resize(oldArray: Int32Array, resizeTo: number): Int32Array {
			const oldBuffer = oldArray['buffer']

			const newBuffer = createNewBuffer(resizeTo * Int32Array.BYTES_PER_ELEMENT)
			const newArray = new Int32Array(newBuffer)
			const buffers = this.buffers
			for (let i = 0, l = buffers.length; i < l; i++) {
				if (buffers[i] === oldBuffer) {
					buffers[i] = newBuffer
					break
				}
			}

			for (let i = 0, l = oldArray.length; i < l; ++i)
				newArray[i] = oldArray[i]!

			this.notifyArraysChanged()
			return newArray
		},
	})

class EntityContainer {
	public buffersChanged: boolean = false
	public readonly ids: DataStore<Int32Array>
	public readonly positions: DataStore<Int32Array>
	public readonly drawables: DataStore<Int32Array>
	public readonly withActivities: DataStore<Int32Array>
	public readonly activitiesMemory: DataStore<Int32Array>
	public readonly itemHoldables: DataStore<Int32Array>
	public readonly interruptibles: DataStore<Int32Array>
	public readonly buildingData: DataStore<Int32Array>

	public readonly allStores: Readonly<DataStore<Int32Array>[]>

	constructor(
		private nextEntityId: number,
		private readonly allocator: ContainerAllocator<Int32Array>,
	) {
		this.ids = DataStore.create(this.allocator, DataOffsetIds.SIZE)
		this.positions = DataStore.create(this.allocator, DataOffsetPositions.SIZE)
		this.drawables = DataStore.create(this.allocator, DataOffsetDrawables.SIZE)
		this.withActivities = DataStore.create(this.allocator, DataOffsetWithActivity.SIZE)
		this.activitiesMemory = DataStore.create(this.allocator, ACTIVITY_MEMORY_SIZE)
		this.itemHoldables = DataStore.create(this.allocator, DataOffsetItemHoldable.SIZE)
		this.interruptibles = DataStore.create(this.allocator, DataOffsetInterruptible.SIZE)
		this.buildingData = DataStore.create(this.allocator, DataOffsetBuildingData.SIZE)

		this.allStores = Object.freeze([
			this.ids,
			this.positions,
			this.drawables,
			this.withActivities,
			this.activitiesMemory,
			this.itemHoldables,
			this.interruptibles,
		])
	}

	public static createEmptyContainer(): EntityContainer {
		let container: EntityContainer

		const allocator = createInt32Allocator([],
			() => container.buffersChanged = true)

		return container = new EntityContainer(1, allocator)
	}

	public static fromReceived(object: any): EntityContainer {
		let container: EntityContainer
		const allocator = createInt32Allocator(object.buffers,
			() => container.buffersChanged = true)

		container = new EntityContainer(-1, allocator)
		return container
	}

	public static deserialize(object: any): EntityContainer {
		let container: EntityContainer
		const buffers = (object['buffers'] as string[]).map(b => decodeArray(b, true, Uint8Array)['buffer'] as SharedArrayBuffer)

		const allocator = createInt32Allocator(buffers,
			() => container.buffersChanged = true)

		container = new EntityContainer(
			object['nextEntityId'],
			allocator)
		return container
	}

	public replaceBuffersFromReceived(data: any): void {
		const buffers = data.buffers as SharedArrayBuffer[]

		this.allocator.buffers = buffers
		this.allocator.reuseCounter = buffers.length
		for (let store of this.allStores)
			store.replaceInternalsUnsafe()
	}

	public passBuffers() {
		return this.allocator.buffers
	}

	public pass(): unknown {
		return {
			buffers: this.allocator.buffers,
		}
	}

	public serialize(): any {
		return {
			'nextEntityId': this.nextEntityId,
			'buffers': this.allocator.buffers.map(array => encodeArray(new Uint8Array(array))),
		}
	}

	public createEntity(traits: EntityTrait): EntityTraitIndicesRecord {
		if (this.nextEntityId === -1)
			throw new Error('Attempt to create entity in non-update context')

		const unitId = this.nextEntityId++

		const record: EntityTraitIndicesRecord = {
			thisId: unitId,
			thisTraits: traits,
			idIndex: this.ids.pushBack(),
			position: hasTrait(traits, EntityTrait.Position) ? this.positions.pushBack() : NO_INDEX,
			drawable: hasTrait(traits, EntityTrait.Drawable) ? this.drawables.pushBack() : NO_INDEX,
			withActivity: hasTrait(traits, EntityTrait.WithActivity) ? this.withActivities.pushBack() : NO_INDEX,
			activityMemory: hasTrait(traits, EntityTrait.WithActivity) ? this.activitiesMemory.pushBack() : NO_INDEX,
			itemHoldable: hasTrait(traits, EntityTrait.ItemHoldable) ? this.itemHoldables.pushBack() : NO_INDEX,
			interruptible: hasTrait(traits, EntityTrait.Interruptible) ? this.interruptibles.pushBack() : NO_INDEX,
			buildingData: hasTrait(traits, EntityTrait.BuildingData) ? this.buildingData.pushBack() : NO_INDEX,
		}

		let index = record.idIndex
		{
			const data = this.ids.rawData
			data[index + DataOffsetIds.ID] = unitId
			data[index + DataOffsetIds.Traits] = traits
		}


		initializeTraitsOfNewEntity(this, record)

		return record
	}

	public * iterate(requiredTraits: EntityTrait): Generator<Readonly<EntityTraitIndicesRecord>> {
		const record = createEmptyTraitRecord()

		const rawData = this.ids.rawData
		for (let i = 0, l = this.ids.size; i < l; i++) {
			const idIndex = i * DataOffsetIds.SIZE + 1
			const traits = rawData[idIndex + DataOffsetIds.Traits]!

			if ((traits & requiredTraits) === requiredTraits) {
				record.thisId = rawData[idIndex + DataOffsetIds.ID]!
				record.thisTraits = rawData[idIndex + DataOffsetIds.Traits]!

				yield record
			}

			if (hasTrait(traits, EntityTrait.Position)) record.position += DataOffsetPositions.SIZE
			if (hasTrait(traits, EntityTrait.Drawable)) record.drawable += DataOffsetDrawables.SIZE
			if (hasTrait(traits, EntityTrait.WithActivity)) {
				record.withActivity += DataOffsetWithActivity.SIZE
				record.activityMemory += ACTIVITY_MEMORY_SIZE
			}
			if (hasTrait(traits, EntityTrait.ItemHoldable)) record.itemHoldable += DataOffsetItemHoldable.SIZE
			if (hasTrait(traits, EntityTrait.Interruptible)) record.interruptible += DataOffsetInterruptible.SIZE
			if (hasTrait(traits, EntityTrait.BuildingData)) record.buildingData += DataOffsetBuildingData.SIZE
		}
	}
}

export default EntityContainer
