import { BuildingId } from '../buildings'
import { ItemType } from '../items'
import EntityContainer, { ACTIVITY_MEMORY_SIZE } from './entity-container'
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

		if (hasTrait(traits, EntityTrait.Drawable)) record.drawable += DataOffsetDrawables.SIZE
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

		if (hasTrait(traits, EntityTrait.Drawable)) record.drawable += DataOffsetDrawables.SIZE
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

		if (hasTrait(traits, EntityTrait.Drawable)) record.drawable += DataOffsetDrawables.SIZE
		if (hasTrait(traits, EntityTrait.Position)) record.position += DataOffsetPositions.SIZE
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

export const queryBuildingDataById = (container: EntityContainer, id: number): { position: [number, number, number], typeId: BuildingId, buildingProgress: number } | null => {
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const thisId = rawData[idIndex + DataOffsetIds.ID]!
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, EntityTrait.Alive) && thisId === id) {
			const positionData = container.positions.rawData
			const x = positionData[record.position + DataOffsetPositions.PositionX]!
			const y = positionData[record.position + DataOffsetPositions.PositionY]!
			const z = positionData[record.position + DataOffsetPositions.PositionZ]!

			const buildingData = container.buildingData.rawData
			const type = buildingData[record.buildingData + DataOffsetBuildingData.TypeId]! as BuildingId
			const progress = buildingData[record.buildingData + DataOffsetBuildingData.ProgressPointsToFull]!

			return {
				position: [x, y, z],
				typeId: type,
				buildingProgress: progress,
			}
		}

		if (hasTrait(traits, EntityTrait.Position)) record.position += DataOffsetPositions.SIZE
		if (hasTrait(traits, EntityTrait.BuildingData)) record.buildingData += DataOffsetBuildingData.SIZE
	}
	return null
}

export const queryBuildingProgress = (container: EntityContainer, id: number):
	number | null => {
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const thisId = rawData[idIndex + DataOffsetIds.ID]!
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, EntityTrait.Alive) && thisId === id) {
			const buildingData = container.buildingData.rawData
			return buildingData[record.buildingData + DataOffsetBuildingData.ProgressPointsToFull]!
		}

		if (hasTrait(traits, EntityTrait.BuildingData)) record.buildingData += DataOffsetBuildingData.SIZE
	}
	return null
}

export const updateBuildingProgress = (container: EntityContainer, id: number, newProgress: number): void => {
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const thisId = rawData[idIndex + DataOffsetIds.ID]!
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, EntityTrait.Alive) && thisId === id) {
			const buildingData = container.buildingData.rawData
			buildingData[record.buildingData + DataOffsetBuildingData.ProgressPointsToFull] = newProgress

			return
		}

		if (hasTrait(traits, EntityTrait.BuildingData)) record.buildingData += DataOffsetBuildingData.SIZE
	}
}


export const queryForAnyUnfinishedBuildingId = (container: EntityContainer): number | null => {
	const record = createEmptyTraitRecord()
	const rawData = container.ids.rawData
	for (let i = 0, l = container.ids.size; i < l; i++) {
		const idIndex = i * DataOffsetIds.SIZE + 1
		const thisId = rawData[idIndex + DataOffsetIds.ID]!
		const traits = rawData[idIndex + DataOffsetIds.Traits]!

		if (hasTrait(traits, EntityTrait.Alive | EntityTrait.BuildingData)) {
			const buildingData = container.buildingData.rawData
			const points = buildingData[record.buildingData + DataOffsetBuildingData.ProgressPointsToFull]!
			if (points > 0)
				return thisId
		}

		if (hasTrait(traits, EntityTrait.BuildingData)) record.buildingData += DataOffsetBuildingData.SIZE
	}
	return null
}
