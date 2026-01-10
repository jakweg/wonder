import { DataOffsetDrawables, DataOffsetIds, DataOffsetPositions } from '../data-offsets'
import EntityContainer from '../entity-container'

import { createEmptyTraitRecord, EntityTrait, EntityTraitIndicesRecord, hasTrait } from '../traits'

export const findAllDrawableEntities = (
  container: EntityContainer,
  forEach: (entity: Readonly<EntityTraitIndicesRecord<'drawable' | 'position'>>) => void,
): void => {
  const filterTraits = EntityTrait.Drawable | EntityTrait.Position
  const record = createEmptyTraitRecord()
  const rawData = container.ids.rawData

  let indexDrawable = 0
  let indexPosition = 0

  for (let i = 0, l = container.ids.size; i < l; i++) {
    const idIndex = i * DataOffsetIds.SIZE
    const traits = rawData[idIndex + DataOffsetIds.Traits]!

    if (hasTrait(traits, filterTraits)) {
      record.drawable = indexDrawable
      record.position = indexPosition
      forEach(record)
    }

    if (hasTrait(traits, EntityTrait.Drawable)) indexDrawable += DataOffsetDrawables.SIZE
    if (hasTrait(traits, EntityTrait.Position)) indexPosition += DataOffsetPositions.SIZE
  }
}
