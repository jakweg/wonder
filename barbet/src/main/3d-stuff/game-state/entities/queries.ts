import { ItemType } from '../../world/item'
import EntityContainer, { ACTIVITY_MEMORY_SIZE } from './entity-container'
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
} from './traits'

export const iterateOverEntitiesWithActivity = function* (container: EntityContainer): Generator<Readonly<EntityTraitIndicesRecord>> {
	const filterTraits = EntityTrait.WithActivity
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, filterTraits)) {
			record.thisId = rawData[idIndex + DataOffsetIds.ID]!
			record.thisTraits = traits

			yield record
		}

		if (hasTrait(traits, EntityTrait.Drawable)) record.drawable += DataOffsetDrawables.SIZE
		if (hasTrait(traits, EntityTrait.Position)) record.position += DataOffsetPositions.SIZE
		if (hasTrait(traits, EntityTrait.WithActivity)) {
			record.withActivity += DataOffsetWithActivity.SIZE
			record.activityMemory += ACTIVITY_MEMORY_SIZE
		}
		if (hasTrait(traits, EntityTrait.Interruptible)) record.interruptible += DataOffsetInterruptible.SIZE
		if (hasTrait(traits, EntityTrait.ItemHoldable)) record.itemHoldable += DataOffsetItemHoldable.SIZE
	}
}


export const iterateOverAllSelectedEntities = function* (container: EntityContainer): Generator<Readonly<EntityTraitIndicesRecord>> {
	const filterTraits = EntityTrait.Interruptible | EntityTrait.Drawable
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, filterTraits)) {
			record.thisId = rawData[idIndex + DataOffsetIds.ID]!
			record.thisTraits = traits!

			yield record
		}

		if (hasTrait(traits, EntityTrait.Interruptible)) record.interruptible += DataOffsetInterruptible.SIZE
	}
}


export const iterateOverEntitiesHoldingItems = function* (container: EntityContainer): Generator<Readonly<EntityTraitIndicesRecord>> {
	const filterTraits = EntityTrait.ItemHoldable | EntityTrait.Drawable | EntityTrait.Position
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	const itemHoldables = container.itemHoldables.rawData

	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, filterTraits)) {
			const type = itemHoldables[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType

			if (type !== ItemType.None) {
				record.thisId = rawData[idIndex + DataOffsetIds.ID]!
				record.thisTraits = traits!

				yield record
			}
		}

		if (hasTrait(traits, EntityTrait.WithActivity)) record.withActivity += DataOffsetWithActivity.SIZE
		if (hasTrait(traits, EntityTrait.Position)) record.position += DataOffsetPositions.SIZE
		if (hasTrait(traits, EntityTrait.ItemHoldable)) record.itemHoldable += DataOffsetItemHoldable.SIZE
	}
}

export const iterateOverDrawableEntities = function* (container: EntityContainer): Generator<Readonly<EntityTraitIndicesRecord>> {
	const filterTraits = EntityTrait.Drawable | EntityTrait.Position
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData

	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, filterTraits)) {
			record.thisId = rawData[idIndex + DataOffsetIds.ID]!
			record.thisTraits = traits!

			yield record
		}

		if (hasTrait(traits, EntityTrait.WithActivity)) record.withActivity += DataOffsetWithActivity.SIZE
		if (hasTrait(traits, EntityTrait.Drawable)) record.drawable += DataOffsetDrawables.SIZE
		if (hasTrait(traits, EntityTrait.Position)) record.position += DataOffsetPositions.SIZE
		if (hasTrait(traits, EntityTrait.ItemHoldable)) record.itemHoldable += DataOffsetItemHoldable.SIZE
	}
}

export const getEntityById_drawableItem = function (container: EntityContainer, id: number): Readonly<EntityTraitIndicesRecord> | null {
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const traits = rawData[idIndex + DataOffsetIds.Traits]!
		const thisId = rawData[idIndex + DataOffsetIds.ID]!

		if (hasTrait(traits, EntityTrait.Alive) && thisId === id) {
			record.thisId = thisId
			record.thisTraits = traits!

			return record
		}

		if (hasTrait(traits, EntityTrait.Drawable)) record.drawable += DataOffsetDrawables.SIZE
		if (hasTrait(traits, EntityTrait.ItemHoldable)) record.itemHoldable += DataOffsetItemHoldable.SIZE
	}
	return null
}
