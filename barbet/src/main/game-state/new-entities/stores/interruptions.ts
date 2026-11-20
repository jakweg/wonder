import EntityId from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

export const enum InterruptionType {
  Startle = 1,
  Hungry = 2,
  MoveToPosition = 3,
  Attacked = 4,
  Die = 100,
}

export type Interruption =
  | { readonly type: InterruptionType.Startle }
  | { readonly type: InterruptionType.Hungry }
  | { readonly type: InterruptionType.MoveToPosition; readonly targetX: number; readonly targetZ: number }
  | { readonly type: InterruptionType.Attacked; readonly attackerId: EntityId }
  | { readonly type: InterruptionType.Die }

interface PendingInterruptionRecord {
  interruption: Interruption
  deferred: boolean
}

/**
 * InterruptionsStore stores the highest-priority pending interruption per entity
 * along with a transient delta set of newly interrupted entity IDs for O(1) wakeup checks.
 */
const InterruptionsStoreCreator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { interruptions },
  } = init.prepareStorage({
    supportedKinds: [EntityKind.Slime],
    dataMaps: {
      interruptions: {} as { value: PendingInterruptionRecord },
    },
  })

  const newlyInterrupted = new Set<EntityId>()
  if (interruptions instanceof Map){
    for (const [entityId, record] of interruptions.entries()) {
      if (!record.deferred) {
        newlyInterrupted.add(entityId)
      }
    }
  }

  return {
    read: {},
    write: {
      sendInterruption(entityId: EntityId, interruption: Interruption): void {
        if (!isEntitySupported(entityId)) return

        const existing = interruptions.get(entityId)
        if (!existing || interruption.type >= existing.interruption.type) {
          interruptions.set(entityId, { interruption, deferred: false })
          newlyInterrupted.add(entityId)
        }
      },
      markInterruptionDeferred(entityId: EntityId): void {
        const existing = interruptions.get(entityId)
        if (existing) {
          existing.deferred = true
        }
      },
      /**
       * Drains all newly interrupted entity IDs into `out` and clears the set.
       * Returns `-1` without modifying the set if `out` is smaller than the current set size.
       */
      drainNewlyInterruptedEntityIds(out: Uint32Array): number {
        const totalSize = newlyInterrupted['size']
        if (totalSize === 0) return 0
        if (out.length < totalSize) return -1

        let count = 0
        for (const entityId of newlyInterrupted) {
          out[count++] = entityId as unknown as number
        }
        newlyInterrupted.clear()

        return count
      },
      getPendingInterruption(entityId: EntityId): Interruption | undefined {
        return interruptions.get(entityId)?.interruption
      },
      consumePendingInterruption(entityId: EntityId): Interruption | undefined {
        const existing = interruptions.get(entityId)
        if (existing !== undefined) {
          interruptions.delete(entityId)
          newlyInterrupted.delete(entityId)
          return existing.interruption
        }
        return undefined
      },
    },
    lifecycle: {
      onEntityAboutToRemove(entityId: EntityId): void {
        interruptions.delete(entityId)
        newlyInterrupted.delete(entityId)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default InterruptionsStoreCreator
