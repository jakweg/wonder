import { InterleavedAttributesLayout } from '@3d/gpu-resources/ultimate-gpu-pipeline'

export type Vec3 = readonly [number, number, number]

const VERTICES_PER_CUBE = 36

interface CubeFace {
  readonly normal: Vec3
  readonly corners: readonly [Vec3, Vec3, Vec3, Vec3]
}

// Unit cube faces [-0.5, +0.5]^3 with CCW outward-facing winding ((v1 - v0) x (v2 - v0) == normal)
const UNIT_CUBE_FACES: readonly CubeFace[] = [
  {
    // +X (front face in local entity space where Direction.PositiveX = 0)
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

export interface SkeletonCubeSpec {
  /**
   * Integer index into the entity's shader palette/material table (resolved dynamically per instance in GLSL,
   * NOT raw RGB, so instances sharing one static mesh can display distinct outfit/skin/hair colors).
   */
  readonly paletteSlot: number
  readonly scale: Vec3
  readonly translate: Vec3
}

/** Mangle-safe single-bone reference (e.g. `{ Torso: true }`), immune to `esbuild --mangle-props` */
export type BoneRef<BoneName extends string> = {
  [K in BoneName]: { readonly [P in K]: true } & Partial<Record<Exclude<BoneName, K>, never>>
}[BoneName]

export type SkeletonBoneName<S> = S extends CompiledSkeleton<infer BoneName> ? BoneName : never

export const extractBoneRefKey = <BoneName extends string>(ref: BoneRef<BoneName>): BoneName => {
  const keys = Object.keys(ref)
  if (keys.length !== 1) {
    throw new Error(`BoneRef must specify exactly 1 bone key, got ${keys.length}.`)
  }
  return keys[0] as BoneName
}

export const resolveBoneIndex = <BoneName extends string>(
  skeleton: CompiledSkeleton<BoneName>,
  ref: BoneRef<BoneName>,
): number => {
  const name = extractBoneRefKey(ref)
  const index = skeleton.boneIndexByName[name]
  if (index === undefined) {
    throw new Error(`Unknown bone '${name}' in skeleton.`)
  }
  return index
}

export interface BoneDefinition<BoneName extends string> {
  /** Parent bone in the kinematic hierarchy (e.g. `{ Torso: true }`), or omit for root bones */
  readonly parent?: BoneRef<BoneName>
  /** Hinge pivot in static model space */
  readonly pivot: Vec3
  /** Static untextured cuboids rigidly attached to this bone */
  readonly cubes: readonly SkeletonCubeSpec[]
}

export interface CompiledSkeleton<BoneName extends string> {
  readonly boneNames: readonly BoneName[]
  readonly boneIndexByName: Readonly<Record<BoneName, number>>
  readonly parentIndices: readonly number[]
  readonly pivots: readonly Vec3[]
  readonly maxChainDepth: number
  readonly cubeCount: number
  readonly vertexCount: number
  buildMesh(layout: InterleavedAttributesLayout<'position' | 'normal' | 'boneAndPalette'>): Uint8Array
}

export const defineSkeleton = <BoneName extends string>(bones: {
  readonly [K in BoneName]: BoneDefinition<NoInfer<BoneName>>
}): CompiledSkeleton<BoneName> => {
  const boneNames = Object.keys(bones) as BoneName[]
  const boneIndexByName = {} as Record<BoneName, number>
  for (let i = 0; i < boneNames.length; ++i) {
    boneIndexByName[boneNames[i]!] = i
  }

  const parentIndices: number[] = []
  const pivots: Vec3[] = []
  const depths: number[] = []
  let maxChainDepth = 0
  let cubeCount = 0

  for (let i = 0; i < boneNames.length; ++i) {
    const name = boneNames[i]!
    const definition = bones[name]
    let parentIndex = -1
    if (definition.parent !== undefined) {
      const parentName = extractBoneRefKey(definition.parent)
      parentIndex = boneIndexByName[parentName]
      if (parentIndex === undefined || parentIndex >= i) {
        throw new Error(`Bone '${name}' must declare its parent '${parentName}' earlier in defineSkeleton.`)
      }
    }
    const depth = parentIndex < 0 ? 1 : depths[parentIndex]! + 1
    depths.push(depth)
    maxChainDepth = Math.max(maxChainDepth, depth)
    parentIndices.push(parentIndex)
    pivots.push(definition.pivot)
    cubeCount += definition.cubes.length
  }

  const vertexCount = cubeCount * VERTICES_PER_CUBE

  return {
    boneNames,
    boneIndexByName,
    parentIndices,
    pivots,
    maxChainDepth,
    cubeCount,
    vertexCount,
    buildMesh(layout) {
      const { strideBytes, elementOffsets } = layout
      const strideFloat32 = strideBytes / Float32Array.BYTES_PER_ELEMENT
      const strideUint16 = strideBytes / Uint16Array.BYTES_PER_ELEMENT

      const buffer = new ArrayBuffer(vertexCount * strideBytes)
      const f32 = new Float32Array(buffer)
      const u16 = new Uint16Array(buffer)

      let vertexIndex = 0

      for (let boneId = 0; boneId < boneNames.length; ++boneId) {
        const definition = bones[boneNames[boneId]!]
        for (const cube of definition.cubes) {
          const [sx, sy, sz] = cube.scale
          const [tx, ty, tz] = cube.translate

          for (const face of UNIT_CUBE_FACES) {
            const [nx, ny, nz] = face.normal

            for (const cornerIndex of QUAD_TRIANGLE_CORNERS) {
              const corner = face.corners[cornerIndex]!
              const baseFloat32 = vertexIndex * strideFloat32
              const baseUint16 = vertexIndex * strideUint16

              f32[baseFloat32 + elementOffsets.position + 0] = corner[0] * sx + tx
              f32[baseFloat32 + elementOffsets.position + 1] = corner[1] * sy + ty
              f32[baseFloat32 + elementOffsets.position + 2] = corner[2] * sz + tz
              f32[baseFloat32 + elementOffsets.normal + 0] = nx
              f32[baseFloat32 + elementOffsets.normal + 1] = ny
              f32[baseFloat32 + elementOffsets.normal + 2] = nz
              u16[baseUint16 + elementOffsets.boneAndPalette + 0] = boneId
              u16[baseUint16 + elementOffsets.boneAndPalette + 1] = cube.paletteSlot
              vertexIndex += 1
            }
          }
        }
      }

      return new Uint8Array(buffer)
    },
  }
}
