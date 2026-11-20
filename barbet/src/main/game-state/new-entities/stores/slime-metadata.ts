import EntityId from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

export const enum SlimeColorId {
  Cyan = 0,
  Lime = 1,
  Emerald = 2,
  Mint = 3,
  Sky = 4,
  Blue = 5,
  Indigo = 6,
  Purple = 7,
  Magenta = 8,
  Rose = 9,
  Red = 10,
  Orange = 11,
  Amber = 12,
  Yellow = 13,
  Coral = 14,
  Pearl = 15,
}

/** 16-entry RGB palette (0xRRGGBB) indexed by SlimeColorId (0..15) */
export const SLIME_COLOR_PALETTE: readonly number[] = [
  0x00ffff, // 0: Cyan
  0x4ade80, // 1: Lime
  0x10b981, // 2: Emerald
  0x5eead4, // 3: Mint
  0x38bdf8, // 4: Sky
  0x3b82f6, // 5: Blue
  0x6366f1, // 6: Indigo
  0xa855f7, // 7: Purple
  0xec4899, // 8: Magenta
  0xf43f5e, // 9: Rose
  0xef4444, // 10: Red
  0xf97316, // 11: Orange
  0xf59e0b, // 12: Amber
  0xfacc15, // 13: Yellow
  0xfb7185, // 14: Coral
  0xe2e8f0, // 15: Pearl
]

/** Default size = 2 corresponds to 1.0x world scale (size / 2.0) */
export const DEFAULT_SLIME_SIZE = 2
const DEFAULT_PACKED_SIZE_AND_COLOR = ((DEFAULT_SLIME_SIZE & 0b1111) << 4) | (SlimeColorId.Cyan & 0b1111)

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
      getSlimeMetadataRaw(entityId: EntityId): number {
        return slimeMetadata.getValueForEntity_orElse(entityId, Fields.SizeAndColor, 0)
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

        slimeMetadata.setValueForEntity_orThrow(entityId, Fields.SizeAndColor, DEFAULT_PACKED_SIZE_AND_COLOR)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default SlimeMetadataStoreCreator
