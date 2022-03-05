import { createNewBuffer } from '../../../util/shared-memory'
import { ArrayAllocator, DataStore } from './data-store'
import {
	createEmptyTraitRecord,
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
	NO_INDEX,
} from './traits'

export const ACTIVITY_MEMORY_SIZE = 20

interface ContainerAllocator<T> extends ArrayAllocator<T> {
	readonly buffers: SharedArrayBuffer[]
	reuseCounter: number
	readonly notifyArraysChanged: (() => void)
}

const createInt32Allocator = (buffers: SharedArrayBuffer[],
                              notify: (() => void)): ContainerAllocator<Int32Array> => ({
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
		const oldBuffer = oldArray.buffer

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

		return newArray
	},
})

class EntityContainer {
	public buffersChanged: boolean = false
	public readonly ids = DataStore.create(this.allocator, DataOffsetIds.SIZE)
	public readonly positions = DataStore.create(this.allocator, DataOffsetPositions.SIZE)
	public readonly drawables = DataStore.create(this.allocator, DataOffsetDrawables.SIZE)
	public readonly withActivities = DataStore.create(this.allocator, DataOffsetWithActivity.SIZE)
	public readonly activitiesMemory = DataStore.create(this.allocator, ACTIVITY_MEMORY_SIZE)
	public readonly itemHoldables = DataStore.create(this.allocator, DataOffsetItemHoldable.SIZE)
	public readonly interruptibles = DataStore.create(this.allocator, DataOffsetInterruptible.SIZE)

	private allStores = Object.freeze([
		this.ids,
		this.positions,
		this.drawables,
		this.withActivities,
		this.activitiesMemory,
		this.itemHoldables,
		this.interruptibles,
	])

	private nextEntityId: number = 1

	constructor(
		private readonly allocator: ContainerAllocator<Int32Array>,
	) {
	}

	public static createEmptyContainer() {
		let container: EntityContainer

		const allocator = createInt32Allocator([],
			() => container.buffersChanged = true)

		return container = new EntityContainer(allocator)
	}


	public static fromReceived(object: any) {
		if (object['type'] !== 'entity-container')
			throw new Error('Invalid object')

		let container: EntityContainer
		const allocator = createInt32Allocator(object['buffers'],
			() => container.buffersChanged = true)

		const sizes = object['sizes']

		container = new EntityContainer(allocator)
		const stores = container.allStores
		for (let i = 0, l = stores.length; i < l; i++) {
			stores[i]!.setSizeUnsafe(sizes[i][0], sizes[i][1])
		}
		return container
	}

	public pass(): unknown {
		return {
			type: 'entity-container',
			buffers: this.allocator.buffers,
			sizes: this.allStores.map(s => [s.size, s.capacity]),
		}
	}

	public createEntity(traits: EntityTrait): EntityTraitIndicesRecord {
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

	public* iterate(requiredTraits: EntityTrait): Generator<Readonly<EntityTraitIndicesRecord>> {
		const record = createEmptyTraitRecord()

		const rawData = this.ids.rawData
		for (let i = 0, l = this.ids.size; i < l; i++) {
			const idIndex = i * DataOffsetIds.SIZE
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
		}
	}

}

export default EntityContainer
