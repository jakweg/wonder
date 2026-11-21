import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'
import SeededRandom from '@seampan/seeded-random'

export const enum SteveShirtColorId {
  Teal = 0,
  Crimson = 1,
  Forest = 2,
  Royal = 3,
  Amber = 4,
  Plum = 5,
  Coral = 6,
  Charcoal = 7,
  Slate = 8,
  Cream = 9,
  Mint = 10,
  Rose = 11,
  Terracotta = 12,
  Navy = 13,
  Olive = 14,
  Sky = 15,
}

export const enum StevePantsColorId {
  Indigo = 0,
  DarkDenim = 1,
  StoneWash = 2,
  Charcoal = 3,
  Khaki = 4,
  Olive = 5,
  Brown = 6,
  Burgundy = 7,
}

export const enum SteveHairColorId {
  DarkBrown = 0,
  Black = 1,
  Chestnut = 2,
  Blonde = 3,
  Ginger = 4,
  Sandy = 5,
  Silver = 6,
  Auburn = 7,
}

export const enum SteveSkinToneId {
  Tan = 0,
  Fair = 1,
  Light = 2,
  WarmPeach = 3,
}

export const enum SteveEyeColorId {
  Indigo = 0,
  Emerald = 1,
  Brown = 2,
  Blue = 3,
}

export const enum SteveShoeColorId {
  Grey = 0,
  Leather = 1,
  White = 2,
  Black = 3,
}

export const enum SteveHairStyle {
  Classic = 0,
  Short = 1,
  Fluffy = 2,
  Long = 3,
}

export const enum SteveShirtTrimStyle {
  MatchingDark = 0,
  CrispWhite = 1,
  Charcoal = 2,
  WarmGold = 3,
}

export const enum SteveAppearanceShift {
  ShirtColor = 0, // 4 bits (0..15)
  PantsColor = 4, // 3 bits (0..7)
  HairColor = 7, // 3 bits (0..7)
  SkinTone = 10, // 2 bits (0..3)
  EyeColor = 12, // 2 bits (0..3)
  ShoeColor = 14, // 2 bits (0..3)
  HairStyle = 16, // 2 bits (0..3)
  ShirtTrimStyle = 18, // 2 bits (0..3)
  HasBeard = 20, // 1 bit (0..1)
  HasLongSleeves = 21, // 1 bit (0..1)
  HeightStep = 22, // 3 bits (0..7)
  WidthStep = 25, // 2 bits (0..3)
}

export const STEVE_HAIR_STYLE_COUNT = 4

export const STEVE_SHIRT_PALETTE: readonly number[] = [
  0x00a8b5, // 0: Teal (classic Steve)
  0xc83737, // 1: Crimson
  0x2e8b57, // 2: Forest
  0x3465c5, // 3: Royal
  0xd99226, // 4: Amber
  0x7d46a8, // 5: Plum
  0xe06043, // 6: Coral
  0x3a3f47, // 7: Charcoal
  0x687788, // 8: Slate
  0xdcd5c5, // 9: Cream
  0x38b28b, // 10: Mint
  0xc9547d, // 11: Rose
  0xb55939, // 12: Terracotta
  0x263f6e, // 13: Navy
  0x6e7d37, // 14: Olive
  0x4ca3dd, // 15: Sky
]

export const STEVE_PANTS_PALETTE: readonly number[] = [
  0x3b49a8, // 0: Indigo (classic Steve)
  0x28355c, // 1: DarkDenim
  0x5b76a8, // 2: StoneWash
  0x353840, // 3: Charcoal
  0x9e8b66, // 4: Khaki
  0x4c5c3b, // 5: Olive
  0x5c4130, // 6: Brown
  0x632d3b, // 7: Burgundy
]

export const STEVE_HAIR_PALETTE: readonly number[] = [
  0x3d2415, // 0: DarkBrown (classic Steve)
  0x1c1b20, // 1: Black
  0x63361f, // 2: Chestnut
  0xc9a353, // 3: Blonde
  0xa64d24, // 4: Ginger
  0x8c6c46, // 5: Sandy
  0xaeb4bd, // 6: Silver
  0x59261b, // 7: Auburn
]

export const STEVE_SKIN_PALETTE: readonly number[] = [
  0xc68665, // 0: Tan (classic Steve)
  0xe8be9e, // 1: Fair
  0xdca886, // 2: Light
  0xd19874, // 3: WarmPeach
]

export const STEVE_EYE_PALETTE: readonly number[] = [
  0x3b2d82, // 0: Indigo (classic Steve)
  0x2a7a4b, // 1: Emerald
  0x663e1e, // 2: Brown
  0x2c78b8, // 3: Blue
]

export const STEVE_SHOE_PALETTE: readonly number[] = [
  0x63636e, // 0: Grey (classic Steve)
  0x66432b, // 1: Leather
  0xd2d6dc, // 2: White
  0x2b2d33, // 3: Black
]

export const STEVE_MIN_HEIGHT_SCALE = 0.91
export const STEVE_HEIGHT_SCALE_STEP = 0.03
export const STEVE_HEIGHT_STEP_COUNT = 8
export const DEFAULT_STEVE_HEIGHT_STEP = 3

export const STEVE_MIN_WIDTH_SCALE = 0.95
export const STEVE_WIDTH_SCALE_STEP = 0.05
export const STEVE_WIDTH_STEP_COUNT = 4
export const DEFAULT_STEVE_WIDTH_STEP = 1

export interface SteveAppearance {
  readonly shirtColor: SteveShirtColorId
  readonly pantsColor: StevePantsColorId
  readonly hairColor: SteveHairColorId
  readonly skinTone: SteveSkinToneId
  readonly eyeColor: SteveEyeColorId
  readonly shoeColor: SteveShoeColorId
  readonly hairStyle: SteveHairStyle
  readonly shirtTrimStyle: SteveShirtTrimStyle
  readonly hasBeard: boolean
  readonly hasLongSleeves: boolean
  readonly heightStep: number
  readonly widthStep: number
}

export const packSteveAppearance = (appearance: SteveAppearance): number => {
  const heightStep = Math.max(0, Math.min(STEVE_HEIGHT_STEP_COUNT - 1, appearance.heightStep | 0))
  const widthStep = Math.max(0, Math.min(STEVE_WIDTH_STEP_COUNT - 1, appearance.widthStep | 0))

  return (
    (((appearance.shirtColor & 0xf) << SteveAppearanceShift.ShirtColor) |
      ((appearance.pantsColor & 0x7) << SteveAppearanceShift.PantsColor) |
      ((appearance.hairColor & 0x7) << SteveAppearanceShift.HairColor) |
      ((appearance.skinTone & 0x3) << SteveAppearanceShift.SkinTone) |
      ((appearance.eyeColor & 0x3) << SteveAppearanceShift.EyeColor) |
      ((appearance.shoeColor & 0x3) << SteveAppearanceShift.ShoeColor) |
      ((appearance.hairStyle & 0x3) << SteveAppearanceShift.HairStyle) |
      ((appearance.shirtTrimStyle & 0x3) << SteveAppearanceShift.ShirtTrimStyle) |
      ((appearance.hasBeard ? 1 : 0) << SteveAppearanceShift.HasBeard) |
      ((appearance.hasLongSleeves ? 1 : 0) << SteveAppearanceShift.HasLongSleeves) |
      ((heightStep & 0x7) << SteveAppearanceShift.HeightStep) |
      ((widthStep & 0x3) << SteveAppearanceShift.WidthStep)) >>>
    0
  )
}

export const DEFAULT_STEVE_APPEARANCE: number = /* @__PURE__ */ packSteveAppearance({
  shirtColor: SteveShirtColorId.Teal,
  pantsColor: StevePantsColorId.Indigo,
  hairColor: SteveHairColorId.DarkBrown,
  skinTone: SteveSkinToneId.Tan,
  eyeColor: SteveEyeColorId.Indigo,
  shoeColor: SteveShoeColorId.Grey,
  hairStyle: SteveHairStyle.Classic,
  shirtTrimStyle: SteveShirtTrimStyle.MatchingDark,
  hasBeard: true,
  hasLongSleeves: false,
  heightStep: DEFAULT_STEVE_HEIGHT_STEP,
  widthStep: DEFAULT_STEVE_WIDTH_STEP,
})

const pickRandomShirtTrimStyle = (random: SeededRandom): SteveShirtTrimStyle => {
  const roll = random.nextInt(100)
  if (roll < 55) return SteveShirtTrimStyle.MatchingDark
  if (roll < 75) return SteveShirtTrimStyle.CrispWhite
  if (roll < 90) return SteveShirtTrimStyle.Charcoal
  return SteveShirtTrimStyle.WarmGold
}

export const generateRandomSteveAppearance = (random: SeededRandom): number => {
  return packSteveAppearance({
    shirtColor: random.nextInt(STEVE_SHIRT_PALETTE.length) as SteveShirtColorId,
    pantsColor: random.nextInt(STEVE_PANTS_PALETTE.length) as StevePantsColorId,
    hairColor: random.nextInt(STEVE_HAIR_PALETTE.length) as SteveHairColorId,
    skinTone: random.nextInt(STEVE_SKIN_PALETTE.length) as SteveSkinToneId,
    eyeColor: random.nextInt(STEVE_EYE_PALETTE.length) as SteveEyeColorId,
    shoeColor: random.nextInt(STEVE_SHOE_PALETTE.length) as SteveShoeColorId,
    hairStyle: random.nextInt(STEVE_HAIR_STYLE_COUNT) as SteveHairStyle,
    shirtTrimStyle: pickRandomShirtTrimStyle(random),
    hasBeard: random.nextInt(100) < 45,
    hasLongSleeves: random.nextInt(100) < 35,
    heightStep: random.nextInt(STEVE_HEIGHT_STEP_COUNT),
    widthStep: random.nextInt(STEVE_WIDTH_STEP_COUNT),
  })
}

const enum Fields {
  AppearancePacked,
  SIZE,
}

/**
 * SteveMetadataStore packs each Steve's appearance traits (outfit colors, skin tone, hair style/color,
 * eye color, beard, sleeve length, and height/build scale) into a single Uint32.
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { steveMetadata },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataBuffers: {
      steveMetadata: { internalType: Uint32Array, fieldsPerEntity: Fields.SIZE },
    },
  })

  return {
    read: {
      getSteveAppearanceRaw(entityId: EntityId): number {
        return steveMetadata.getValueForEntity_orElse(entityId, Fields.AppearancePacked, DEFAULT_STEVE_APPEARANCE)
      },
    },
    write: {
      setSteveAppearance(entityId: EntityId, appearance: SteveAppearance): void {
        if (!isEntitySupported(entityId)) return

        steveMetadata.setValueForEntity_orThrow(entityId, Fields.AppearancePacked, packSteveAppearance(appearance))
      },
      setSteveAppearanceRaw(entityId: EntityId, packedAppearance: number): void {
        if (!isEntitySupported(entityId)) return

        steveMetadata.setValueForEntity_orThrow(entityId, Fields.AppearancePacked, packedAppearance >>> 0)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        steveMetadata.setValueForEntity_orThrow(entityId, Fields.AppearancePacked, DEFAULT_STEVE_APPEARANCE)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
