import { MAX_ENTITIES_PER_ARCHETYPE, Store } from './store'
import StoreFactory from './factory'
import { EntityId, getGenerationFromEntityId } from '../entity'
import { EntityArchetype } from '../archetypes'

const STORE_NAME = 'change-id'

const enum Generation {
  GenerationId,
  SIZE,
}

function getAliveBitFromGenerationId(generation: number) {
  return ((generation >> 7) & 0b1) === 0b1
}
function setAliveBitInGenerationId(generation: number, isAlive: boolean) {
  return (generation & 0b0111_1111) | (isAlive ? 0b1000_0000 : 0)
}
function getNextGenerationId(generation: number) {
  return ((generation & 0b0111_1111) + 1) & 0b0111_1111
}

export default (factory: StoreFactory) => {
  const store = Store.createNew<Generation, Uint8ArrayConstructor>(STORE_NAME, factory, [], Generation.SIZE, Uint8Array)

  const raw = store.getRawStorage()

  return {
    isEntityStillAlive(entity: EntityId): boolean {
      const generationFromStore = store.get(entity, Generation.GenerationId)
      const generationFromEntity = getGenerationFromEntityId(entity)

      return generationFromStore === generationFromEntity && getAliveBitFromGenerationId(generationFromStore)
    },

    findAvailableEntityIndex(archetype: EntityArchetype): number | null {
      if (!store.isArchetypeSupportedByThisStore(archetype)) return null
      const startOffset = store.calculateArchetypeOffset(archetype)
      for (let i = 0; i < MAX_ENTITIES_PER_ARCHETYPE; ++i) {
        const generation = raw[startOffset + i * Generation.SIZE]!

        const isAlive = getAliveBitFromGenerationId(generation)

        if (!isAlive) return i
      }
      return null
    },

    markEntityAsDead(entity: EntityId) {
      const oldGeneration = store.get(entity, Generation.GenerationId)
      const newGeneration = setAliveBitInGenerationId(oldGeneration, false)
      store.set(entity, Generation.GenerationId, newGeneration)
    },

    markEntityIndexAsNextAliveEntityAndGetGenerationId(archetype: EntityArchetype, index: number) {
      const startOffset = store.calculateArchetypeOffset(archetype)
      const oldGeneration = raw[startOffset + index * Generation.SIZE]!

      const isAlive = getAliveBitFromGenerationId(oldGeneration)
      if (isAlive) throw new Error()

      const newGeneration = setAliveBitInGenerationId(getNextGenerationId(oldGeneration), true)

      raw[startOffset + index * Generation.SIZE] = newGeneration

      return newGeneration
    },

    unsafe_checkIfAlive(archetype: EntityArchetype, index: number): boolean {
      raw[]
    }
  }
}
