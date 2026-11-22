import ChunkVisibilityIndex from '@3d/chunk-visibility'
import EntityId from '@game/new-entities/id'
import { EntityKind, getMaxEntitiesByKind } from '@game/new-entities/kind'
import { GeneralEntityStoreReadonly } from '@game/new-entities/store'

export interface EntitiesForDrawingQuery {
  readonly entityIds: readonly EntityId[] // backed by Uint32Array
  refresh(): number
}

export const createEntitiesForDrawingQuery = (
  entities: GeneralEntityStoreReadonly,
  visibility: ChunkVisibilityIndex,
  kind: EntityKind,
): EntitiesForDrawingQuery => {
  const rawIds = new Uint32Array(getMaxEntitiesByKind(kind))

  return {
    entityIds: rawIds as unknown as readonly EntityId[],
    refresh(): number {
      const aliveCount = entities.fillAliveIdsOfKind(kind, rawIds)
      let writeIndex = 0

      for (let i = 0; i < aliveCount; ++i) {
        const rawId = rawIds[i]!
        const entityId = rawId as unknown as EntityId
        const { x, z } = entities.getPosition(entityId)!

        if (visibility.isPointInViewport(x, z)) {
          rawIds[writeIndex++] = rawId
        }
      }

      return writeIndex
    },
  }
}
