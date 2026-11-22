import { MirrorBoneMap } from '@3d/skeletal/clip'
import { defineSkeleton, SkeletonBoneName, SkeletonCubeSpec, Vec3 } from '@3d/skeletal/skeleton'

/**
 * Per-cuboid palette/material slot resolved dynamically in the shader against each Steve's appearance bitfield.
 */
export const enum StevePaletteSlot {
  Skin = 0,
  SkinShadow = 1,
  ForearmSkin = 2,
  HairCrown = 3,
  HairBack = 4,
  HairSide = 5,
  HairBangs = 6,
  Beard = 7,
  Shirt = 8,
  ShirtTrim = 9,
  LongSleeveCuff = 10,
  Pants = 11,
  PantsTrim = 12,
  Shoe = 13,
  ShoeSole = 14,
  EyeWhite = 15,
  EyePupil = 16,
  Mouth = 17,
}

/** 32 model pixels correspond to Steve's canonical 1.8-block height */
export const STEVE_PIXEL_SCALE = 1.8 / 32

/** Head sits 0.8 pixels below torso top (y = 24) so pitching/turning never opens a neck gap */
const HEAD_BOTTOM_PIXELS = 23.2
const ARM_OFFSET_PIXELS = 6.45
const LEG_OFFSET_PIXELS = 2.08
const EYE_HEIGHT_PIXELS = 1.16
const EYE_CENTER_FROM_CHIN_PIXELS = 4.5

export const STEVE_KNEE_Y = 6 * STEVE_PIXEL_SCALE
export const STEVE_HIP_Y = 12 * STEVE_PIXEL_SCALE
export const STEVE_ELBOW_Y = 18 * STEVE_PIXEL_SCALE
export const STEVE_SHOULDER_Y = 22 * STEVE_PIXEL_SCALE
export const STEVE_NECK_Y = 23.5 * STEVE_PIXEL_SCALE
export const STEVE_ARM_OFFSET_Z = ARM_OFFSET_PIXELS * STEVE_PIXEL_SCALE
export const STEVE_LEG_OFFSET_Z = LEG_OFFSET_PIXELS * STEVE_PIXEL_SCALE

export const STEVE_HAIR_CROWN_MID_Y = (HEAD_BOTTOM_PIXELS + 7.12) * STEVE_PIXEL_SCALE
export const STEVE_HAIR_BACK_MID_Y = (HEAD_BOTTOM_PIXELS + 4.5) * STEVE_PIXEL_SCALE
export const STEVE_HAIR_SIDE_MID_Y = (HEAD_BOTTOM_PIXELS + 5.1) * STEVE_PIXEL_SCALE
export const STEVE_EYE_BOTTOM_Y =
  (HEAD_BOTTOM_PIXELS + EYE_CENTER_FROM_CHIN_PIXELS - EYE_HEIGHT_PIXELS * 0.5) * STEVE_PIXEL_SCALE
export const STEVE_HEAD_FRONT_RETRACT_X = 3.96 * STEVE_PIXEL_SCALE

const cube = (paletteSlot: StevePaletteSlot, scalePixels: Vec3, translatePixels: Vec3): SkeletonCubeSpec => ({
  paletteSlot,
  scale: [scalePixels[0] * STEVE_PIXEL_SCALE, scalePixels[1] * STEVE_PIXEL_SCALE, scalePixels[2] * STEVE_PIXEL_SCALE],
  translate: [
    translatePixels[0] * STEVE_PIXEL_SCALE,
    translatePixels[1] * STEVE_PIXEL_SCALE,
    translatePixels[2] * STEVE_PIXEL_SCALE,
  ],
})

const headCube = (paletteSlot: StevePaletteSlot, scalePixels: Vec3, offsetFromChinPixels: Vec3): SkeletonCubeSpec =>
  cube(paletteSlot, scalePixels, [
    offsetFromChinPixels[0],
    HEAD_BOTTOM_PIXELS + offsetFromChinPixels[1],
    offsetFromChinPixels[2],
  ])

const mirroredHeadCubes = (
  paletteSlot: StevePaletteSlot,
  scalePixels: Vec3,
  [x, yFromChin, absZ]: Vec3,
): readonly SkeletonCubeSpec[] => [
  headCube(paletteSlot, scalePixels, [x, yFromChin, -absZ]),
  headCube(paletteSlot, scalePixels, [x, yFromChin, absZ]),
]

const createUpperArmCubes = (zPixels: number): readonly SkeletonCubeSpec[] => [
  cube(StevePaletteSlot.Shirt, [4.46, 4, 4.46], [0, 22, zPixels]),
  cube(StevePaletteSlot.ShirtTrim, [4.76, 0.85, 4.76], [0, 20.05, zPixels]),
  cube(StevePaletteSlot.ForearmSkin, [4.06, 2.7, 4.06], [0, 18.95, zPixels]),
]

const createForearmCubes = (zPixels: number): readonly SkeletonCubeSpec[] => [
  cube(StevePaletteSlot.ForearmSkin, [3.9, 4.4, 3.9], [0, 16.3, zPixels]),
  cube(StevePaletteSlot.LongSleeveCuff, [4.56, 0.8, 4.56], [0, 14.45, zPixels]),
  cube(StevePaletteSlot.Skin, [3.72, 2.4, 3.72], [0, 13.4, zPixels]),
]

const createThighCubes = (zPixels: number): readonly SkeletonCubeSpec[] => [
  cube(StevePaletteSlot.Pants, [3.94, 5.6, 3.9], [0, 9.2, zPixels]),
  cube(StevePaletteSlot.PantsTrim, [4.26, 1.1, 4.06], [0.04, 6.05, zPixels]),
]

const createShinCubes = (zPixels: number): readonly SkeletonCubeSpec[] => [
  cube(StevePaletteSlot.Pants, [3.86, 3.1, 3.82], [0, 4.75, zPixels]),
  cube(StevePaletteSlot.PantsTrim, [4.36, 1.15, 4.1], [0, 2.72, zPixels]),
  cube(StevePaletteSlot.Shoe, [4.54, 1.5, 4.06], [0.18, 1.45, zPixels]),
  cube(StevePaletteSlot.ShoeSole, [4.66, 0.7, 4.12], [0.22, 0.35, zPixels]),
]

export const steveSkeleton = defineSkeleton({
  Torso: {
    pivot: [0, STEVE_HIP_Y, 0],
    cubes: [
      cube(StevePaletteSlot.Shirt, [4, 12, 7.88], [0, 18, 0]),
      cube(StevePaletteSlot.Skin, [0.44, 1.2, 4], [2, 22.9, 0]),
      cube(StevePaletteSlot.Skin, [0.42, 1, 2], [2, 21.9, 0]),
      cube(StevePaletteSlot.ShirtTrim, [0.56, 1.1, 4.2], [-2.08, 22.85, 0]),
      cube(StevePaletteSlot.ShirtTrim, [4.52, 1.35, 8.32], [0, 12.68, 0]),
    ],
  },
  Head: {
    parent: { Torso: true },
    pivot: [0, STEVE_NECK_Y, 0],
    cubes: [
      headCube(StevePaletteSlot.Skin, [8, 8, 8], [0, 4, 0]),
      headCube(StevePaletteSlot.HairCrown, [8.44, 2.24, 8.44], [0, 7.12, 0]),
      headCube(StevePaletteSlot.HairBack, [2.44, 3, 8.44], [-3, 4.5, 0]),
      ...mirroredHeadCubes(StevePaletteSlot.HairSide, [2.8, 1.8, 0.44], [-0.38, 5.1, 4]),
      ...mirroredHeadCubes(StevePaletteSlot.HairBangs, [1.44, 0.86, 1.2], [3.5, 5.57, 3.62]),
      ...mirroredHeadCubes(
        StevePaletteSlot.EyeWhite,
        [0.44, EYE_HEIGHT_PIXELS, 2],
        [4.02, EYE_CENTER_FROM_CHIN_PIXELS, 2],
      ),
      ...mirroredHeadCubes(StevePaletteSlot.EyePupil, [0.44, 0.92, 0.96], [4.1, EYE_CENTER_FROM_CHIN_PIXELS, 2]),
      headCube(StevePaletteSlot.SkinShadow, [0.56, 0.94, 2], [4.08, 3.45, 0]),
      headCube(StevePaletteSlot.Mouth, [0.42, 1, 2], [4.01, 2.5, 0]),
      ...mirroredHeadCubes(StevePaletteSlot.Beard, [0.48, 2, 1], [4.04, 2, 1.5]),
      headCube(StevePaletteSlot.Beard, [0.48, 1, 2], [4.04, 1.5, 0]),
    ],
  },
  LeftUpperArm: {
    parent: { Torso: true },
    pivot: [0, STEVE_SHOULDER_Y, -STEVE_ARM_OFFSET_Z],
    cubes: createUpperArmCubes(-ARM_OFFSET_PIXELS),
  },
  LeftForearm: {
    parent: { LeftUpperArm: true },
    pivot: [0, STEVE_ELBOW_Y, -STEVE_ARM_OFFSET_Z],
    cubes: createForearmCubes(-ARM_OFFSET_PIXELS),
  },
  RightUpperArm: {
    parent: { Torso: true },
    pivot: [0, STEVE_SHOULDER_Y, STEVE_ARM_OFFSET_Z],
    cubes: createUpperArmCubes(ARM_OFFSET_PIXELS),
  },
  RightForearm: {
    parent: { RightUpperArm: true },
    pivot: [0, STEVE_ELBOW_Y, STEVE_ARM_OFFSET_Z],
    cubes: createForearmCubes(ARM_OFFSET_PIXELS),
  },
  LeftThigh: {
    pivot: [0, STEVE_HIP_Y, -STEVE_LEG_OFFSET_Z],
    cubes: createThighCubes(-LEG_OFFSET_PIXELS),
  },
  LeftShin: {
    parent: { LeftThigh: true },
    pivot: [0, STEVE_KNEE_Y, -STEVE_LEG_OFFSET_Z],
    cubes: createShinCubes(-LEG_OFFSET_PIXELS),
  },
  RightThigh: {
    pivot: [0, STEVE_HIP_Y, STEVE_LEG_OFFSET_Z],
    cubes: createThighCubes(LEG_OFFSET_PIXELS),
  },
  RightShin: {
    parent: { RightThigh: true },
    pivot: [0, STEVE_KNEE_Y, STEVE_LEG_OFFSET_Z],
    cubes: createShinCubes(LEG_OFFSET_PIXELS),
  },
})

export type SteveBoneName = SkeletonBoneName<typeof steveSkeleton>

export const STEVE_MIRROR_BONES = {
  LeftUpperArm: { RightUpperArm: true },
  LeftForearm: { RightForearm: true },
  LeftThigh: { RightThigh: true },
  LeftShin: { RightShin: true },
} as const satisfies MirrorBoneMap<SteveBoneName>

export const STEVE_VERTEX_COUNT = steveSkeleton.vertexCount
