import { ActivityId } from '../activities'
import { InterruptType } from '../activities/interrupt'
import {
  DataOffsetDrawables,
  DataOffsetInterruptible,
  DataOffsetPositions,
  DataOffsetWithActivity,
} from './data-offsets'
import EntityContainer, { ACTIVITY_MEMORY_SIZE } from './entity-container'

export const enum EntityTrait {
  Alive = 1 << 31,
  Position = Alive | (1 << 0),
  Drawable = Alive | Position | (1 << 1),
  Interruptible = Alive | (1 << 2),
  WithActivity = Alive | (1 << 3),
}

export const createEmptyTraitRecord = () => ({
  thisId: 0,
  thisTraits: 0,
  idIndex: 0,
  position: 0,
  drawable: 0,
  withActivity: 0,
  activityMemory: 0,
  interruptible: 0,
})

type ExcludedFields = 'idIndex' | 'thisId' | 'thisTraits'

export type EntityTraitIndicesRecord<
  Options extends Exclude<keyof ReturnType<typeof createEmptyTraitRecord>, ExcludedFields> = Exclude<
    keyof ReturnType<typeof createEmptyTraitRecord>,
    ExcludedFields
  >,
> = Pick<ReturnType<typeof createEmptyTraitRecord>, Options>

export const hasTrait = (all: EntityTrait, required: EntityTrait): boolean => (all & required) === required

export const requireTrait = (all: EntityTrait, required: EntityTrait): void => {
  if (!hasTrait(all, required)) throw new Error(`Missing trait ${required.toString(2)} got only ${all.toString(2)}`)
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
    data[index + DataOffsetDrawables.ModelId] = -1
  }

  index = record.withActivity
  if (index !== NO_INDEX) {
    const data = container.withActivities.rawData
    data[index + DataOffsetWithActivity.CurrentActivityId] = ActivityId.None
    data[index + DataOffsetWithActivity.SuspendUntilTick] = 0
    data[index + DataOffsetWithActivity.MemoryPointer] = 0
  }

  index = record.activityMemory
  if (index !== NO_INDEX) {
    const data = container.activitiesMemory.rawData
    const value = 0x45 // 69
    data.fill(value, index, index + ACTIVITY_MEMORY_SIZE)
  }

  index = record.interruptible
  if (index !== NO_INDEX) {
    const data = container.interruptibles.rawData
    data[index + DataOffsetInterruptible.InterruptType] = InterruptType.None
  }
}
