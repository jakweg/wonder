import EntityId, {
  calculateNewGenerationIdForAliveEntity,
  createAliveEntityIdFromRaw,
  entityId_extractGeneration,
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
    },
    write: {
      spawnNewSync(kind: EntityKind): EntityId {
        if (!isKindSupported(kind)) return INVALID_ENTITY_ID

        const maxAliveOfThisKind = getMaxEntitiesByKind(kind)

        for (let i = 0; i < maxAliveOfThisKind; ++i) {
          const currentGenerationId = generations.getValueForEntity_orThrow(
            createAliveEntityIdFromRaw(kind, /* placeholder, does not matter  */ 0, i),
            Fields.AliveBitAndGenerationId,
          )

          if (isEntityAliveByGenerationId(currentGenerationId)) {
            continue
          }

          const newGenerationId = calculateNewGenerationIdForAliveEntity(currentGenerationId)
          const newEntityId = createAliveEntityIdFromRaw(kind, newGenerationId, i)

          generations.setValueForEntity_orThrow(newEntityId, Fields.AliveBitAndGenerationId, newGenerationId)

          return newEntityId
        }

        // looks like we can't spawn entity, probably we run out of `maxAliveOfThisKind`
        return INVALID_ENTITY_ID
      },
    },
  }
}

export default GenerationStoreCreator
