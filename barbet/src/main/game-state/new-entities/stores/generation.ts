import EntityId, {
  calculateDeadGenerationId,
  calculateNewGenerationIdForAliveEntity,
  createAliveEntityIdFromRaw,
  entityId_extractGeneration,
  entityId_extractIndex,
  entityId_extractKind,
  INVALID_ENTITY_ID,
  isEntityAliveByGenerationId,
} from '@game/new-entities/id'
import { EntityKind, getMaxEntitiesByKind } from '@game/new-entities/kind'
import { StoreInitializer } from '@game/new-entities/stores/factory'

const enum Fields {
  AliveBitAndGenerationId,
  SIZE,
}

const GenerationStoreCreator = (init: StoreInitializer) => {
  const {
    isKindSupported,
    storage: { generations },
  } = init.prepareStorage({
    supportedKinds: [EntityKind.Slime],
    dataBuffers: {
      generations: { internalType: Uint8Array, fieldsPerEntity: Fields.SIZE },
    },
  })

  // Lowest potentially free slot index per kind (all indices < minFreeIndexByKind[kind] are guaranteed alive)
  const minFreeIndexByKind = new Uint32Array(EntityKind.SIZE)

  return {
    read: {
      isEntityAlive(entityId: EntityId): boolean {
        const generation = entityId_extractGeneration(entityId)
        if (!isEntityAliveByGenerationId(generation)) {
          return false
        }
        const readGeneration = generations.getValueForEntity_orThrow(entityId, Fields.AliveBitAndGenerationId)

        return readGeneration === generation
      },
      fillAliveIdsOfKind(kind: EntityKind, out: Uint32Array): number {
        if (!isKindSupported(kind)) return 0

        const maxEntities = getMaxEntitiesByKind(kind)
        const limit = Math.min(out.length, maxEntities)
        let count = 0

        for (let i = 0; i < maxEntities; ++i) {
          const probeId = createAliveEntityIdFromRaw(kind, 0, i)
          const generationId = generations.getValueForEntity_orThrow(probeId, Fields.AliveBitAndGenerationId)
          if (!isEntityAliveByGenerationId(generationId)) continue

          if (count >= limit) break
          out[count++] = createAliveEntityIdFromRaw(kind, generationId, i) as unknown as number
        }

        return count
      },
    },
    write: {},
    internal: {
      /* Allocates a new entity ID in the first available slot; caller must always check if returned ID is not INVALID_ENTITY_ID */
      allocEntityId(kind: EntityKind): EntityId {
        if (!isKindSupported(kind)) return INVALID_ENTITY_ID

        const maxAliveOfThisKind = getMaxEntitiesByKind(kind)

        for (let i = minFreeIndexByKind[kind]!; i < maxAliveOfThisKind; ++i) {
          const currentGenerationId = generations.getValueForEntity_orThrow(
            createAliveEntityIdFromRaw(kind, /* placeholder, does not matter  */ 0, i),
            Fields.AliveBitAndGenerationId,
          )

          if (isEntityAliveByGenerationId(currentGenerationId)) {
            continue
          }

          minFreeIndexByKind[kind] = i + 1
          const newGenerationId = calculateNewGenerationIdForAliveEntity(currentGenerationId)
          const newEntityId = createAliveEntityIdFromRaw(kind, newGenerationId, i)

          generations.setValueForEntity_orThrow(newEntityId, Fields.AliveBitAndGenerationId, newGenerationId)

          return newEntityId
        }

        minFreeIndexByKind[kind] = maxAliveOfThisKind
        // looks like we can't spawn entity, probably we run out of `maxAliveOfThisKind`
        return INVALID_ENTITY_ID
      },
      /* Marks the entity's slot as empty while preserving its generation counter */
      freeEntityId(entityId: EntityId): void {
        const generation = entityId_extractGeneration(entityId)
        if (!isEntityAliveByGenerationId(generation)) return

        const readGeneration = generations.getValueForEntity_orThrow(entityId, Fields.AliveBitAndGenerationId)
        if (readGeneration !== generation) return

        generations.setValueForEntity_orThrow(
          entityId,
          Fields.AliveBitAndGenerationId,
          calculateDeadGenerationId(readGeneration),
        )

        const kind = entityId_extractKind(entityId)
        const index = entityId_extractIndex(entityId)
        if (index < minFreeIndexByKind[kind]!) {
          minFreeIndexByKind[kind] = index
        }
      },
    },
  }
}

export default GenerationStoreCreator
