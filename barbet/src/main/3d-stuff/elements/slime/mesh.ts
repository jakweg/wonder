import { InterleavedAttributesLayout } from '@3d/gpu-resources/ultimate-gpu-pipeline'

export const enum SlimeMeshPart {
  Body = 0,
  Eye = 1,
  Mouth = 2,
}

const VERTICES_PER_CUBE = 36
const CUBE_COUNT = 4

export const SLIME_VERTEX_COUNT = VERTICES_PER_CUBE * CUBE_COUNT

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
    // +X (front face in local slime space where Direction.PositiveX = 0)
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

interface SlimeCubePartSpec {
  readonly partId: SlimeMeshPart
  readonly scale: readonly [number, number, number]
  readonly translate: readonly [number, number, number]
}

// Exact static transforms ported from legacy model/entity/slime/index.ts
const SLIME_CUBE_PARTS: readonly SlimeCubePartSpec[] = [
  {
    partId: SlimeMeshPart.Body,
    scale: [1, 1, 1],
    translate: [0, 0, 0],
  },
  {
    // Left eye
    partId: SlimeMeshPart.Eye,
    scale: [0.1, 0.16, 0.16],
    translate: [0.53, 0.25, -0.23],
  },
  {
    // Right eye
    partId: SlimeMeshPart.Eye,
    scale: [0.1, 0.16, 0.16],
    translate: [0.53, 0.25, 0.23],
  },
  {
    // Mouth
    partId: SlimeMeshPart.Mouth,
    scale: [0.1, 0.12, 0.12],
    translate: [0.53, -0.15, 0.03],
  },
]

export const buildSlimeMesh = (
  layout: InterleavedAttributesLayout<'position' | 'normal' | 'partId'>,
): Uint8Array => {
  const { strideBytes, elementOffsets } = layout
  const wordsPerVertex = strideBytes / Uint32Array.BYTES_PER_ELEMENT

  const buffer = new ArrayBuffer(SLIME_VERTEX_COUNT * strideBytes)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)

  let wordOffset = 0

  for (const part of SLIME_CUBE_PARTS) {
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
        wordOffset += wordsPerVertex
      }
    }
  }

  return new Uint8Array(buffer)
}
