import { Direction } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { UnitColorPaletteId } from '../../renderable/unit/unit-color'
import { ItemType } from '../../world/item'
import { InterruptType } from '../activities/interrupt'
import { ACTIVITY_MEMORY_SIZE } from '../game-state'
import { DataStore } from './data-store'
import {
	createEmptyTraitRecord,
	DataOffsetDrawables,
	DataOffsetIds,
	DataOffsetInterruptible,
	DataOffsetItemHoldable,
	DataOffsetPositions,
	DataOffsetWithActivity,
	hasTrait,
	UnitTraitIndicesRecord,
	UnitTraits,
} from './traits'

class UnitsContainer {
	public readonly ids = DataStore.createInt32(DataOffsetIds.SIZE)
	public readonly positions = DataStore.createInt32(DataOffsetPositions.SIZE)
	public readonly drawables = DataStore.createInt32(DataOffsetDrawables.SIZE)
	public readonly withActivities = DataStore.createInt32(DataOffsetWithActivity.SIZE)
	public readonly activitiesMemory = DataStore.createInt32(ACTIVITY_MEMORY_SIZE)
	public readonly itemHoldables = DataStore.createInt32(DataOffsetItemHoldable.SIZE)
	public readonly interruptibles = DataStore.createInt32(DataOffsetInterruptible.SIZE)
	private nextUnitId: number = 1

	public static createEmptyContainer() {
		return new UnitsContainer()
	}

	public createEntity(traits: UnitTraits): UnitTraitIndicesRecord {
		const NO_INDEX = -1
		const unitId = this.nextUnitId++

		const record: UnitTraitIndicesRecord = {
			thisId: unitId,
			thisTraits: traits,
			idIndex: this.ids.pushBack(),
			position: hasTrait(traits, UnitTraits.Position) ? this.positions.pushBack() : NO_INDEX,
			drawable: hasTrait(traits, UnitTraits.Drawable) ? this.drawables.pushBack() : NO_INDEX,
			withActivity: hasTrait(traits, UnitTraits.WithActivity) ? this.withActivities.pushBack() : NO_INDEX,
			activityMemory: hasTrait(traits, UnitTraits.WithActivity) ? this.activitiesMemory.pushBack() : NO_INDEX,
			itemHoldable: hasTrait(traits, UnitTraits.ItemHoldable) ? this.itemHoldables.pushBack() : NO_INDEX,
			interruptible: hasTrait(traits, UnitTraits.Interruptible) ? this.interruptibles.pushBack() : NO_INDEX,
		}

		let index = record.idIndex
		{
			const data = this.ids.rawData
			data[index + DataOffsetIds.ID] = unitId
			data[index + DataOffsetIds.Traits] = traits
		}


		index = record.position
		if (index !== NO_INDEX) {
			const data = this.positions.rawData
			data[index + DataOffsetPositions.PositionX] = 0
			data[index + DataOffsetPositions.PositionY] = 0
			data[index + DataOffsetPositions.PositionZ] = 0
		}

		index = record.drawable
		if (index !== NO_INDEX) {
			const data = this.drawables.rawData
			data[index + DataOffsetDrawables.Rotation] = Direction.PositiveX
			data[index + DataOffsetDrawables.ColorPaletteId] = UnitColorPaletteId.LightOrange
		}

		index = record.withActivity
		if (index !== NO_INDEX) {
			const data = this.withActivities.rawData
			data[index + DataOffsetWithActivity.CurrentId] = ActivityId.None
			data[index + DataOffsetWithActivity.StartTick] = 0
			data[index + DataOffsetWithActivity.MemoryPointer] = 0
		}

		index = record.activityMemory
		if (index !== NO_INDEX) {
			const data = this.activitiesMemory.rawData
			const value = 0x45 // 69
			data.fill(value, index, index + ACTIVITY_MEMORY_SIZE)
		}

		index = record.itemHoldable
		if (index !== NO_INDEX) {
			const data = this.itemHoldables.rawData
			data[index + DataOffsetItemHoldable.ItemId] = ItemType.None
		}

		index = record.interruptible
		if (index !== NO_INDEX) {
			const data = this.interruptibles.rawData
			data[index + DataOffsetInterruptible.InterruptType] = InterruptType.None
		}

		return record
	}

	public* iterate(requiredTraits: UnitTraits): Generator<Readonly<UnitTraitIndicesRecord>> {
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

			if (hasTrait(traits, UnitTraits.Position)) record.position += DataOffsetPositions.SIZE
			if (hasTrait(traits, UnitTraits.Drawable)) record.drawable += DataOffsetDrawables.SIZE
			if (hasTrait(traits, UnitTraits.WithActivity)) {
				record.withActivity += DataOffsetWithActivity.SIZE
				record.activityMemory += ACTIVITY_MEMORY_SIZE
			}
			if (hasTrait(traits, UnitTraits.ItemHoldable)) record.itemHoldable += DataOffsetItemHoldable.SIZE
			if (hasTrait(traits, UnitTraits.Interruptible)) record.interruptible += DataOffsetInterruptible.SIZE
		}
	}
}

export default UnitsContainer
