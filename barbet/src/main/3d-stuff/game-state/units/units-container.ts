import { Direction } from '../../../util/direction'
import { ActivityId } from '../../renderable/unit/activity'
import { UnitColorPaletteId } from '../../renderable/unit/unit-color'
import { ItemType } from '../../world/item'
import { ACTIVITY_MEMORY_SIZE } from '../game-state'
import { DataStore } from './data-store'

export type UnitId = number

export const enum UnitTraits {
	Alive = 1 << 31,
	Position = Alive | 1 << 0,
	Drawable = Alive | Position | 1 << 1,
	Interruptible = Alive | 1 << 2,
	WithActivity = Alive | 1 << 3,
	ItemHoldable = Alive | 1 << 4
}

export const enum DataOffsetIds {
	ID,
	Traits,
	SIZE,
}

export const enum DataOffsetPositions {
	PositionX,
	PositionY,
	PositionZ,
	SIZE,
}

export const enum DataOffsetDrawables {
	ColorPaletteId,
	Rotation,
	SIZE,
}

export const enum DataOffsetWithActivity {
	CurrentId,
	StartTick,
	MemoryPointer,
	SIZE,
}

export const enum DataOffsetItemHoldable {
	ItemId,
	SIZE,
}

export interface UnitTraitIndicesRecord {
	thisId: number
	thisTraits: number
	idIndex: number
	position: number
	drawable: number
	withActivity: number
	activityMemory: number
	itemHoldable: number
}

class UnitsContainer {
	public readonly ids = DataStore.createInt32(DataOffsetIds.SIZE)
	public readonly positions = DataStore.createInt32(DataOffsetPositions.SIZE)
	public readonly drawables = DataStore.createInt32(DataOffsetDrawables.SIZE)
	public readonly withActivities = DataStore.createInt32(DataOffsetWithActivity.SIZE)
	public readonly activitiesMemory = DataStore.createInt32(ACTIVITY_MEMORY_SIZE)
	public readonly itemHoldables = DataStore.createInt32(DataOffsetItemHoldable.SIZE)
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
			position: (traits & UnitTraits.Position) === UnitTraits.Position ? this.positions.pushBack() : NO_INDEX,
			drawable: (traits & UnitTraits.Drawable) === UnitTraits.Drawable ? this.drawables.pushBack() : NO_INDEX,
			withActivity: (traits & UnitTraits.WithActivity) === UnitTraits.WithActivity ? this.withActivities.pushBack() : NO_INDEX,
			activityMemory: (traits & UnitTraits.WithActivity) === UnitTraits.WithActivity ? this.activitiesMemory.pushBack() : NO_INDEX,
			itemHoldable: (traits & UnitTraits.ItemHoldable) === UnitTraits.ItemHoldable ? this.itemHoldables.pushBack() : NO_INDEX,
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
			data[index + DataOffsetWithActivity.CurrentId] = ActivityId.Idle
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

		return record
	}

	public* iterate(requiredTraits: UnitTraits): Generator<Readonly<UnitTraitIndicesRecord>> {
		const record: UnitTraitIndicesRecord = {
			thisId: 0,
			thisTraits: 0,
			idIndex: 0,
			position: 0,
			drawable: 0,
			withActivity: 0,
			activityMemory: 0,
			itemHoldable: 0,
		}

		const rawData = this.ids.rawData
		for (let i = 0, l = this.ids.size; i < l; i++) {
			const idIndex = i * DataOffsetIds.SIZE
			const traits = rawData[idIndex + DataOffsetIds.Traits]!

			if ((traits & requiredTraits) === requiredTraits) {
				record.thisId = rawData[idIndex + DataOffsetIds.ID]!
				record.thisTraits = rawData[idIndex + DataOffsetIds.Traits]!

				yield record
			}

			if ((traits & UnitTraits.Position) === UnitTraits.Position) record.position += DataOffsetPositions.SIZE
			if ((traits & UnitTraits.Drawable) === UnitTraits.Drawable) record.drawable += DataOffsetDrawables.SIZE
			if ((traits & UnitTraits.WithActivity) === UnitTraits.WithActivity) record.withActivity += DataOffsetWithActivity.SIZE
			if ((traits & UnitTraits.WithActivity) === UnitTraits.WithActivity) record.activityMemory += ACTIVITY_MEMORY_SIZE
			if ((traits & UnitTraits.ItemHoldable) === UnitTraits.ItemHoldable) record.itemHoldable += DataOffsetItemHoldable.SIZE
		}
	}
}

export default UnitsContainer
