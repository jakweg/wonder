export const enum EntityTrait {
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

export const enum DataOffsetInterruptible {
	InterruptType,
	ValueA,
	ValueB,
	ValueC,
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
}

export const createEmptyTraitRecord = (): EntityTraitIndicesRecord => ({
	thisId: 0,
	thisTraits: 0,
	idIndex: 0,
	position: 0,
	drawable: 0,
	withActivity: 0,
	activityMemory: 0,
	itemHoldable: 0,
	interruptible: 0,
})

export const hasTrait = (all: EntityTrait, required: EntityTrait): boolean => (all & required) === required

export const requireTrait = (all: EntityTrait, required: EntityTrait): void => {
	if (!hasTrait(all, required))
		throw new Error(`Missing trait ${required.toString(2)} got only ${all.toString(2)}`)
}
