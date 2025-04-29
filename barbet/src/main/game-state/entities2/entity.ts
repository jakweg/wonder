import { EntityArchetype } from './archetypes'

export type EntityId = never

export const getArchetypeFromEntityId = (fullEntityId: EntityId) => {
  return (((fullEntityId as number) >>> 24) & 0xff) as EntityArchetype
}

export const getGenerationFromEntityId = (fullEntityId: EntityId) => {
  return ((fullEntityId as number) >>> 16) & 0xff
}

export const getIndexFromEntityId = (fullEntityId: EntityId) => {
  return ((fullEntityId as number) >>> 0) & 0xffff
}

export const entityIdToString = (fullEntityId: EntityId) => {
  const arch = getArchetypeFromEntityId(fullEntityId)
  const change = getGenerationFromEntityId(fullEntityId)
  const index = getIndexFromEntityId(fullEntityId)

  function format(v: number) {
    return v['toString'](16)['padStart'](2, '0')
  }

  return `Entity { arch=${format(arch)} change=${format(change)} index=${format(index)}`
}

export const constructFullEntityId = (archetype: EntityArchetype, generationId: number, index: number): EntityId => {
  return (((archetype & 0xff) << 24) | ((generationId & 0xff) << 16) | ((index & 0xffff) << 0)) as EntityId
}
