import EntityId from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

/** TODO: Replace with actual SlimeColorId once implemented */
export type SlimeColorId = number

const enum Fields {
  SizeAndColor,
  SIZE,
}

/**
 * SlimeMetadataStore allows slime entities to store 4-bit size and 4-bit color ID in a single byte
 */
const SlimeMetadataStoreCreator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { slimeMetadata },
  } = init.prepareStorage({
    supportedKinds: [EntityKind.Slime],
    dataBuffers: {
      slimeMetadata: { internalType: Uint8Array, fieldsPerEntity: Fields.SIZE },
    },
  })

  return {
    read: {
      getSlimeSize(entityId: EntityId): number | null {
        if (!isEntitySupported(entityId)) return null

        const packed = slimeMetadata.getValueForEntity_orThrow(entityId, Fields.SizeAndColor)
        return (packed >> 4) & 0b1111
      },
      getSlimeColor(entityId: EntityId): SlimeColorId | null {
        if (!isEntitySupported(entityId)) return null

        const packed = slimeMetadata.getValueForEntity_orThrow(entityId, Fields.SizeAndColor)
        return (packed & 0b1111) as SlimeColorId
      },
    },
    write: {
      setSlimeSize(entityId: EntityId, size: number): void {
        if (!isEntitySupported(entityId)) return

        const current = slimeMetadata.getValueForEntity_orThrow(entityId, Fields.SizeAndColor)
        const packed = (current & 0b0000_1111) | ((size & 0b1111) << 4)
        slimeMetadata.setValueForEntity_orThrow(entityId, Fields.SizeAndColor, packed)
      },
      setSlimeColor(entityId: EntityId, color: SlimeColorId): void {
        if (!isEntitySupported(entityId)) return

        const current = slimeMetadata.getValueForEntity_orThrow(entityId, Fields.SizeAndColor)
        const packed = (current & 0b1111_0000) | (color & 0b1111)
        slimeMetadata.setValueForEntity_orThrow(entityId, Fields.SizeAndColor, packed)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        slimeMetadata.setValueForEntity_orThrow(entityId, Fields.SizeAndColor, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default SlimeMetadataStoreCreator
