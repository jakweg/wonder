import { Direction } from '../../util/direction'
import { ActivityId } from '../activities'
import { InterruptType } from '../activities/interrupt'
import { BuildingId } from '../buildings'
import { ItemType } from '../items'
import EntityContainer, { ACTIVITY_MEMORY_SIZE } from './entity-container'

export const enum EntityTrait {
	Alive = 1 << 31,
	Position = Alive | 1 << 0,
	Drawable = Alive | Position | 1 << 1,
	Interruptible = Alive | 1 << 2,
	WithActivity = Alive | 1 << 3,
	ItemHoldable = Alive | 1 << 4,
	BuildingData = Alive | 1 << 5,
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

export const enum DataOffsetInterruptible {
	InterruptType,
	ValueA,
	ValueB,
	ValueC,
	SIZE,
}

export const enum DataOffsetBuildingData {
	TypeId,
	ProgressPointsToFull,
	SIZE,
}

export interface EntityTraitIndicesRecord {
	thisId: number
	thisTraits: number
	idIndex: number
	position: number
	drawable: number
	withActivity: number
	activityMemory: number
	itemHoldable: number
	interruptible: number
	buildingData: number
}

export const createEmptyTraitRecord = (): EntityTraitIndicesRecord => ({
	thisId: 0,
	thisTraits: 0,
	idIndex: 1,
	position: 1,
	drawable: 1,
	withActivity: 1,
	activityMemory: 1,
	itemHoldable: 1,
	interruptible: 1,
	buildingData: 1,
})

export const hasTrait = (all: EntityTrait, required: EntityTrait): boolean => (all & required) === required

export const requireTrait = (all: EntityTrait, required: EntityTrait): void => {
	if (!hasTrait(all, required))
		throw new Error(`Missing trait ${required.toString(2)} got only ${all.toString(2)}`)
}

export const NO_INDEX = -1
export const initializeTraitsOfNewEntity = (container: EntityContainer, record: EntityTraitIndicesRecord): void => {
	let index
	index = record.position
	if (index !== NO_INDEX) {
		const data = container.positions.rawData
		data[index + DataOffsetPositions.PositionX] = 0
		data[index + DataOffsetPositions.PositionY] = 0
		data[index + DataOffsetPositions.PositionZ] = 0
	}

	index = record.drawable
	if (index !== NO_INDEX) {
		const data = container.drawables.rawData
		data[index + DataOffsetDrawables.Rotation] = Direction.PositiveX
		data[index + DataOffsetDrawables.ColorPaletteId] = 0 //UnitColorPaletteId.LightOrange
	}

	index = record.withActivity
	if (index !== NO_INDEX) {
		const data = container.withActivities.rawData
		data[index + DataOffsetWithActivity.CurrentId] = ActivityId.None
		data[index + DataOffsetWithActivity.StartTick] = 0
		data[index + DataOffsetWithActivity.MemoryPointer] = 0
	}

	index = record.activityMemory
	if (index !== NO_INDEX) {
		const data = container.activitiesMemory.rawData
		const value = 0x45 // 69
		data.fill(value, index, index + ACTIVITY_MEMORY_SIZE)
	}

	index = record.itemHoldable
	if (index !== NO_INDEX) {
		const data = container.itemHoldables.rawData
		data[index + DataOffsetItemHoldable.ItemId] = ItemType.None
	}

	index = record.interruptible
	if (index !== NO_INDEX) {
		const data = container.interruptibles.rawData
		data[index + DataOffsetInterruptible.InterruptType] = InterruptType.None
	}

	index = record.buildingData
	if (index !== NO_INDEX) {
		const data = container.buildingData.rawData
		data[index + DataOffsetBuildingData.TypeId] = BuildingId.None
		data[index + DataOffsetBuildingData.ProgressPointsToFull] = 0
	}
}

