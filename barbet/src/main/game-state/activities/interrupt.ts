import { DataOffsetInterruptible } from "../entities/data-offsets"
import EntityContainer from '../entities/entity-container'
import { EntityTrait, EntityTraitIndicesRecord, requireTrait } from '../entities/traits'

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
   * Player requested the unit to continue working on building a building, data is ID of building entity
   */
  BuildSomeBuilding,
}

export const interruptRequestWalk = (
  container: EntityContainer,
  unit: EntityTraitIndicesRecord,
  x: number,
  z: number,
) => {
  requireTrait(unit.thisTraits, EntityTrait.Interruptible)

  const memory = container.interruptibles.rawData
  memory[unit.interruptible + DataOffsetInterruptible.InterruptType] = InterruptType.Walk
  memory[unit.interruptible + DataOffsetInterruptible.ValueA] = x
  memory[unit.interruptible + DataOffsetInterruptible.ValueB] = z
}

export const interruptBuild = (container: EntityContainer, unit: EntityTraitIndicesRecord, buildingId: number) => {
  requireTrait(unit.thisTraits, EntityTrait.Interruptible)

  const memory = container.interruptibles.rawData
  memory[unit.interruptible + DataOffsetInterruptible.InterruptType] = InterruptType.BuildSomeBuilding
  memory[unit.interruptible + DataOffsetInterruptible.ValueA] = buildingId
}
