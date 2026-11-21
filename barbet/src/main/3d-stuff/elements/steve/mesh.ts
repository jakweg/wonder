import { InterleavedAttributesLayout } from '@3d/gpu-resources/ultimate-gpu-pipeline'

export const enum SteveMeshPart {
  Head = 0,
  Torso = 1,
  LeftUpperArm = 2,
  LeftForearm = 3,
  RightUpperArm = 4,
  RightForearm = 5,
  LeftThigh = 6,
  LeftShin = 7,
  RightThigh = 8,
  RightShin = 9,
}

export const enum SteveColorId {
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

const VERTICES_PER_CUBE = 36

interface CubeFace {
  readonly normal: readonly [number, number, number]
  readonly corners: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
}

// Unit cube faces [-0.5, +0.5]^3 with CCW outward-facing winding ((v1 - v0) x (v2 - v0) == normal)
const UNIT_CUBE_FACES: readonly CubeFace[] = [
  {
    // +X (front face in local Steve space where Direction.PositiveX = 0)
    normal: [1, 0, 0],
    corners: [
      [0.5, -0.5, 0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
    ],
  },
  {
    // -X (back)
    normal: [-1, 0, 0],
    corners: [
      [-0.5, -0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
    ],
  },
  {
    // +Y (top)
    normal: [0, 1, 0],
    corners: [
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5],
    ],
  },
  {
    // -Y (bottom)
    normal: [0, -1, 0],
    corners: [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
      [-0.5, -0.5, 0.5],
    ],
  },
  {
    // +Z (right side when facing +X)
    normal: [0, 0, 1],
    corners: [
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ],
  },
  {
    // -Z (left side when facing +X)
    normal: [0, 0, -1],
    corners: [
      [0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
    ],
  },
]

const QUAD_TRIANGLE_CORNERS = [0, 1, 2, 0, 2, 3] as const

type Vec3 = readonly [number, number, number]

interface SteveCubePartSpec {
  readonly partId: SteveMeshPart
  readonly colorId: SteveColorId
  readonly scale: Vec3
  readonly translate: Vec3
}

const cube = (
  partId: SteveMeshPart,
  colorId: SteveColorId,
  scalePixels: Vec3,
  translatePixels: Vec3,
): SteveCubePartSpec => ({
  partId,
  colorId,
  scale: [scalePixels[0] * STEVE_PIXEL_SCALE, scalePixels[1] * STEVE_PIXEL_SCALE, scalePixels[2] * STEVE_PIXEL_SCALE],
  translate: [
    translatePixels[0] * STEVE_PIXEL_SCALE,
    translatePixels[1] * STEVE_PIXEL_SCALE,
    translatePixels[2] * STEVE_PIXEL_SCALE,
  ],
})

const headCube = (colorId: SteveColorId, scalePixels: Vec3, offsetFromChinPixels: Vec3): SteveCubePartSpec =>
  cube(SteveMeshPart.Head, colorId, scalePixels, [
    offsetFromChinPixels[0],
    HEAD_BOTTOM_PIXELS + offsetFromChinPixels[1],
    offsetFromChinPixels[2],
  ])

const mirroredHeadCubes = (
  colorId: SteveColorId,
  scalePixels: Vec3,
  [x, yFromChin, absZ]: Vec3,
): readonly SteveCubePartSpec[] => [
  headCube(colorId, scalePixels, [x, yFromChin, -absZ]),
  headCube(colorId, scalePixels, [x, yFromChin, absZ]),
]

const createArmCubes = (
  upperArmPart: SteveMeshPart,
  forearmPart: SteveMeshPart,
  zPixels: number,
): readonly SteveCubePartSpec[] => [
  // Upper arm: shoulder sleeve, short-sleeve cuff rim, and lower bicep overlapping elbow (y = 18)
  cube(upperArmPart, SteveColorId.Shirt, [4.46, 4, 4.46], [0, 22, zPixels]),
  cube(upperArmPart, SteveColorId.ShirtTrim, [4.76, 0.85, 4.76], [0, 20.05, zPixels]),
  cube(upperArmPart, SteveColorId.ForearmSkin, [4.06, 2.7, 4.06], [0, 18.95, zPixels]),

  // Forearm: lower arm hinged at elbow (y = 18), optional long-sleeve cuff, and slightly tapered hand
  cube(forearmPart, SteveColorId.ForearmSkin, [3.9, 4.4, 3.9], [0, 16.3, zPixels]),
  cube(forearmPart, SteveColorId.LongSleeveCuff, [4.56, 0.8, 4.56], [0, 14.45, zPixels]),
  cube(forearmPart, SteveColorId.Skin, [3.72, 2.4, 3.72], [0, 13.4, zPixels]),
]

const createLegCubes = (
  thighPart: SteveMeshPart,
  shinPart: SteveMeshPart,
  zPixels: number,
): readonly SteveCubePartSpec[] => [
  // Thigh & sculpted knee band (hinged at hip y = 12 and knee y = 6)
  cube(thighPart, SteveColorId.Pants, [3.94, 5.6, 3.9], [0, 9.2, zPixels]),
  cube(thighPart, SteveColorId.PantsTrim, [4.26, 1.1, 4.06], [0.04, 6.05, zPixels]),

  // Shin, ankle cuff, shoe, and sole
  cube(shinPart, SteveColorId.Pants, [3.86, 3.1, 3.82], [0, 4.75, zPixels]),
  cube(shinPart, SteveColorId.PantsTrim, [4.36, 1.15, 4.1], [0, 2.72, zPixels]),
  cube(shinPart, SteveColorId.Shoe, [4.54, 1.5, 4.06], [0.18, 1.45, zPixels]),
  cube(shinPart, SteveColorId.ShoeSole, [4.66, 0.7, 4.12], [0.22, 0.35, zPixels]),
]

// Untextured sculpted Steve geometry (in 1/16th-block model pixels, feet at y = 0, facing +X)
const STEVE_CUBE_PARTS: readonly SteveCubePartSpec[] = [
  // Head & hair (local y offsets measured from chin at HEAD_BOTTOM_PIXELS)
  headCube(SteveColorId.Skin, [8, 8, 8], [0, 4, 0]),
  headCube(SteveColorId.HairCrown, [8.44, 2.24, 8.44], [0, 7.12, 0]),
  headCube(SteveColorId.HairBack, [2.44, 3, 8.44], [-3, 4.5, 0]),
  ...mirroredHeadCubes(SteveColorId.HairSide, [2.8, 1.8, 0.44], [-0.38, 5.1, 4]),
  ...mirroredHeadCubes(SteveColorId.HairBangs, [1.44, 0.86, 1.2], [3.5, 5.57, 3.62]),

  // Eyes, nose, mouth, and optional goatee
  ...mirroredHeadCubes(SteveColorId.EyeWhite, [0.44, EYE_HEIGHT_PIXELS, 2], [4.02, EYE_CENTER_FROM_CHIN_PIXELS, 2]),
  ...mirroredHeadCubes(SteveColorId.EyePupil, [0.44, 0.92, 0.96], [4.1, EYE_CENTER_FROM_CHIN_PIXELS, 2]),
  headCube(SteveColorId.SkinShadow, [0.56, 0.94, 2], [4.08, 3.45, 0]),
  headCube(SteveColorId.Mouth, [0.42, 1, 2], [4.01, 2.5, 0]),
  ...mirroredHeadCubes(SteveColorId.Beard, [0.48, 2, 1], [4.04, 2, 1.5]),
  headCube(SteveColorId.Beard, [0.48, 1, 2], [4.04, 1.5, 0]),

  // Torso (slightly narrower than head in Z so overlapping neck never Z-fights on the sides)
  cube(SteveMeshPart.Torso, SteveColorId.Shirt, [4, 12, 7.88], [0, 18, 0]),
  cube(SteveMeshPart.Torso, SteveColorId.Skin, [0.44, 1.2, 4], [2, 22.9, 0]),
  cube(SteveMeshPart.Torso, SteveColorId.Skin, [0.42, 1, 2], [2, 21.9, 0]),
  cube(SteveMeshPart.Torso, SteveColorId.ShirtTrim, [0.56, 1.1, 4.2], [-2.08, 22.85, 0]),
  cube(SteveMeshPart.Torso, SteveColorId.ShirtTrim, [4.52, 1.35, 8.32], [0, 12.68, 0]),

  // Articulated arms & legs
  ...createArmCubes(SteveMeshPart.LeftUpperArm, SteveMeshPart.LeftForearm, -ARM_OFFSET_PIXELS),
  ...createArmCubes(SteveMeshPart.RightUpperArm, SteveMeshPart.RightForearm, ARM_OFFSET_PIXELS),
  ...createLegCubes(SteveMeshPart.LeftThigh, SteveMeshPart.LeftShin, -LEG_OFFSET_PIXELS),
  ...createLegCubes(SteveMeshPart.RightThigh, SteveMeshPart.RightShin, LEG_OFFSET_PIXELS),
]

export const STEVE_VERTEX_COUNT = VERTICES_PER_CUBE * STEVE_CUBE_PARTS.length

export const buildSteveMesh = (
  layout: InterleavedAttributesLayout<'position' | 'normal' | 'partId' | 'colorId'>,
): Uint8Array => {
  const { strideBytes, elementOffsets } = layout
  const wordsPerVertex = strideBytes / Uint32Array.BYTES_PER_ELEMENT

  const buffer = new ArrayBuffer(STEVE_VERTEX_COUNT * strideBytes)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)

  let wordOffset = 0

  for (const part of STEVE_CUBE_PARTS) {
    const [sx, sy, sz] = part.scale
    const [tx, ty, tz] = part.translate

    for (const face of UNIT_CUBE_FACES) {
      const [nx, ny, nz] = face.normal

      for (const cornerIndex of QUAD_TRIANGLE_CORNERS) {
        const corner = face.corners[cornerIndex]!
        f32[wordOffset + elementOffsets.position + 0] = corner[0] * sx + tx
        f32[wordOffset + elementOffsets.position + 1] = corner[1] * sy + ty
        f32[wordOffset + elementOffsets.position + 2] = corner[2] * sz + tz
        f32[wordOffset + elementOffsets.normal + 0] = nx
        f32[wordOffset + elementOffsets.normal + 1] = ny
        f32[wordOffset + elementOffsets.normal + 2] = nz
        u32[wordOffset + elementOffsets.partId] = part.partId
        u32[wordOffset + elementOffsets.colorId] = part.colorId
        wordOffset += wordsPerVertex
      }
    }
  }

  return new Uint8Array(buffer)
}
