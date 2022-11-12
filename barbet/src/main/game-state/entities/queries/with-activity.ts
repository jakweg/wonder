import {
  DataOffsetDrawables,
  DataOffsetIds,
  DataOffsetInterruptible,
  DataOffsetPositions,
  DataOffsetWithActivity,
} from '../data-offsets'

import { createEmptyTraitRecord, EntityTrait, EntityTraitIndicesRecord, hasTrait } from '../traits'

import EntityContainer, { ACTIVITY_MEMORY_SIZE } from '../entity-container'

export const findAllNotSuspendedEntitiesWithActivity = (
  container: EntityContainer,
  forEach: (entity: Readonly<EntityTraitIndicesRecord>) => void,
  currentTick: number,
): void => {
  const filterTraits = EntityTrait.Drawable | EntityTrait.Position | EntityTrait.WithActivity
  const record = createEmptyTraitRecord()
  const rawData = container.ids.rawData
  const activitiesData = container.withActivities.rawData

  let indexDrawable = 0
  let indexPosition = 0
  let withActivity = 0
  let interruptible = 0

  for (let i = 0, l = container.ids.size; i < l; i++) {
    const idIndex = i * DataOffsetIds.SIZE
    const traits = rawData[idIndex + DataOffsetIds.Traits]!

    if (hasTrait(traits, filterTraits)) {
      const withActivityIndex = withActivity * DataOffsetWithActivity.SIZE
      const suspendedUntil = activitiesData[withActivityIndex + DataOffsetWithActivity.SuspendUntilTick]! | 0

      if (suspendedUntil <= currentTick) {
        record.thisId = rawData[idIndex + DataOffsetIds.ID]!
        record.thisTraits = traits

        record.drawable = indexDrawable
        record.position = indexPosition
        record.withActivity = withActivityIndex
        record.activityMemory = withActivity * ACTIVITY_MEMORY_SIZE
        record.interruptible = interruptible
        forEach(record)
      }
    }

    if (hasTrait(traits, EntityTrait.Drawable)) indexDrawable += DataOffsetDrawables.SIZE
    if (hasTrait(traits, EntityTrait.Position)) indexPosition += DataOffsetPositions.SIZE
    if (hasTrait(traits, EntityTrait.Interruptible)) interruptible += DataOffsetInterruptible.SIZE
    if (hasTrait(traits, EntityTrait.WithActivity)) withActivity++
  }
}
