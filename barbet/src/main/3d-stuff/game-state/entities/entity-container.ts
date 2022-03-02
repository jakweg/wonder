import { DataStore } from './data-store'
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

class EntityContainer {
	public readonly ids = DataStore.createInt32(DataOffsetIds.SIZE)
	public readonly positions = DataStore.createInt32(DataOffsetPositions.SIZE)
	public readonly drawables = DataStore.createInt32(DataOffsetDrawables.SIZE)
	public readonly withActivities = DataStore.createInt32(DataOffsetWithActivity.SIZE)
	public readonly activitiesMemory = DataStore.createInt32(ACTIVITY_MEMORY_SIZE)
	public readonly itemHoldables = DataStore.createInt32(DataOffsetItemHoldable.SIZE)
	public readonly interruptibles = DataStore.createInt32(DataOffsetInterruptible.SIZE)
	private nextEntityId: number = 1

	public static createEmptyContainer() {
		return new EntityContainer()
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
