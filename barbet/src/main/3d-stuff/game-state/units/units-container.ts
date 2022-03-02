import { Direction } from '../../../util/direction'
import { UnitColorPaletteId } from '../../renderable/unit/unit-color'
import { DataStore } from './data-store'

export type UnitId = number

export const enum UnitTraits {
	Alive = 1 << 31,
	Position = Alive | 1 << 0,
	Drawable = Alive | Position | 1 << 1,
	Interruptible = Alive | 1 << 2,
	WithActivity = Alive | 1 << 3,

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

export interface UnitTraitIndicesRecord {
	thisId: number
	thisTraits: number
	idIndex: number
	position: number
	drawable: number
}

class UnitsContainer {
	public readonly ids = DataStore.createInt32(DataOffsetIds.SIZE)
	public readonly positions = DataStore.createInt32(DataOffsetPositions.SIZE)
	public readonly drawables = DataStore.createInt32(DataOffsetDrawables.SIZE)
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

		return record
	}

	public* iterate(requiredTraits: UnitTraits): Generator<Readonly<UnitTraitIndicesRecord>> {
		const record: UnitTraitIndicesRecord = {
			thisId: 0,
			thisTraits: 0,
			idIndex: 0,
			position: 0,
			drawable: 0,
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
		}
	}
}

export default UnitsContainer
