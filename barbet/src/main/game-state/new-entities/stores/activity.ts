import type { ActivityId } from '@game/new-entities/activities'
import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

/** Max Uint32 (4_294_967_295). Always normalize wake ticks with `>>> 0` so values stay positive JS numbers. */
export const SLEEP_INDEFINITELY = 0xffff_ffff

export interface ActivityFrame<S = any> {
  readonly activityId: ActivityId
  state: S
}

export interface EntityActivityEntry {
  wakeTick: number
  readonly frames: ActivityFrame[]
}

/**
 * ActivityStore maintains each active entity's call stack of `{ activityId, state }` frames and next `wakeTick`.
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { activities },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataMaps: {
      activities: {} as { value: EntityActivityEntry },
    },
  })

  return {
    read: {},
    write: {
      getTopActivityFrame(entityId: EntityId): ActivityFrame | undefined {
        return activities.get(entityId)?.frames['at'](-1)
      },
      getActivityStackDepth(entityId: EntityId): number {
        return activities.get(entityId)?.frames.length ?? 0
      },
      getWakeTick(entityId: EntityId): number {
        return activities.get(entityId)?.wakeTick ?? SLEEP_INDEFINITELY
      },
      pushActivityFrame<S>(entityId: EntityId, activityId: ActivityId, state: S, wakeTick: number): void {
        if (!isEntitySupported(entityId)) return

        const normalizedWakeTick = wakeTick >>> 0
        let entry = activities.get(entityId)
        if (!entry) {
          entry = { wakeTick: normalizedWakeTick, frames: [] }
          activities.set(entityId, entry)
        } else {
          entry.wakeTick = normalizedWakeTick
        }
        entry.frames.push({ activityId, state })
      },
      popActivityFrame(entityId: EntityId): ActivityFrame | undefined {
        const entry = activities.get(entityId)
        if (!entry) return undefined

        const popped = entry.frames.pop()
        if (entry.frames.length === 0) {
          // TODO: decide whether an entity in ActivityStore can ever have an empty activity stack
          activities.delete(entityId)
        } else {
          entry.wakeTick = 0
        }
        return popped
      },
      setWakeTick(entityId: EntityId, wakeTick: number): void {
        const entry = activities.get(entityId)
        if (!entry) return

        entry.wakeTick = wakeTick >>> 0
      },
      fillDueActivityEntityIds(currentTick: number, out: Uint32Array): number {
        // TODO: replace linear scan with timing wheel
        if (activities['size'] === 0) return 0

        const normalizedCurrentTick = currentTick >>> 0
        const limit = out.length
        let count = 0

        for (const [entityId, entry] of activities.entries()) {
          if (entry.frames.length > 0 && entry.wakeTick <= normalizedCurrentTick) {
            if (count >= limit) return -1
            out[count++] = entityId as unknown as number
          }
        }

        return count
      },
    },
    lifecycle: {
      onEntityAboutToRemove(entityId: EntityId): void {
        activities.delete(entityId)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
