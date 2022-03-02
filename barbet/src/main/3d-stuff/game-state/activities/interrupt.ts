import { ItemType } from '../../world/item'
import { DataOffsetInterruptible, requireTrait, UnitTraitIndicesRecord, UnitTraits } from '../units/traits'
import UnitsContainer from '../units/units-container'

export const enum InterruptType {
	/**
	 * No interruption happened, doesn't hold any additional data
	 */
	None,
	/**
	 * Player requested the unit to walk, data is x, z of tile requested to go to
	 */
	Walk,
	/**
	 * Player requested the unit to pick up item, data is x, z of tile where the item is located and item type
	 */
	ItemPickUp,
}

export const interruptRequestWalk = (container: UnitsContainer, unit: UnitTraitIndicesRecord, x: number, z: number) => {
	requireTrait(unit.thisTraits, UnitTraits.Interruptible)

	const memory = container.interruptibles.rawData
	memory[unit.interruptible + DataOffsetInterruptible.InterruptType] = InterruptType.Walk
	memory[unit.interruptible + DataOffsetInterruptible.ValueA] = x
	memory[unit.interruptible + DataOffsetInterruptible.ValueB] = z
}

export const interruptRequestItemPickUp = (container: UnitsContainer, unit: UnitTraitIndicesRecord, x: number, z: number, type: ItemType) => {
	requireTrait(unit.thisTraits, UnitTraits.Interruptible)

	const memory = container.interruptibles.rawData
	memory[unit.interruptible + DataOffsetInterruptible.InterruptType] = InterruptType.ItemPickUp
	memory[unit.interruptible + DataOffsetInterruptible.ValueA] = x
	memory[unit.interruptible + DataOffsetInterruptible.ValueB] = z
	memory[unit.interruptible + DataOffsetInterruptible.ValueC] = type
}
