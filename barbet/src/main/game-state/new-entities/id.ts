import { EntityKind } from '@game/new-entities/kind'

export declare class EntityId {
  private thisIsPhantomClass: 'does not use directly!'
  private constructor()
}

export default EntityId

/**
 * Represents lack of entity
 * should not be used to query anything.
 * Might be returned to represent error etc.
 */
export const INVALID_ENTITY_ID = 0 as any as EntityId

/** Creates entity id by encoding data needed to retrieve this entity */
export const createAliveEntityIdFromRaw = (kind: EntityKind, generationId: number, index: number): EntityId => {
  // (1 << 23) is alive bit
  const finalId = ((kind & 0xff) << 24) | (1 << 23) | ((generationId & 0b111_1111) << 16) | ((index & 0xffff) << 0)

  return finalId as any as EntityId
}

export const isEntityAliveByGenerationId = (generationId: number): boolean => {
  return !!((generationId & 0xff) >> 7)
}

export const calculateNewGenerationIdForAliveEntity = (generationId: number): number => {
  const oldGeneration = generationId & 0b111_1111
  const newGeneration = (oldGeneration + 1) & 0b111_1111
  const aliveBit = 1 << 7
  return aliveBit | newGeneration
}

export const entityId_extractKind = (id: EntityId): EntityKind => {
  return (((id as any as number) >> 24) & 0xff) as EntityKind
}

export const entityId_extractGeneration = (id: EntityId): EntityKind => {
  return (((id as any as number) >> 16) & 0xff) as EntityKind
}

export const entityId_extractIndex = (id: EntityId): number => {
  return ((id as any as number) >> 0) & 0xffff
}
