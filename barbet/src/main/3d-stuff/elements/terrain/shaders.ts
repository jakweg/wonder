import { TerrainHeightMultiplierUniform, WorldSizeInChunksUniform } from '@3d/common-shader'
import { AttrType } from '@3d/gpu-resources/program'
import { createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { TextureSlot } from '@3d/texture-slot-counter'
import { allBlocks } from '@game/world/block'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'

export const BYTES_PER_VERTEX = 6

const allBlockColors = /* @__PURE__ */ allBlocks
  .map(block => [
    (((block.color >> 16) & 0xff) / 255).toFixed(9),
    (((block.color >> 8) & 0xff) / 255).toFixed(9),
    (((block.color >> 0) & 0xff) / 255).toFixed(9),
  ])
  .map(([r, g, b]) => `vec3(${r},${g},${b})`)

const utilDeclarations = () => `
const vec3[4] vertexOffsetsY = vec3[4] (
  vec3(0.0, 0.0, 0.0), // 0: NW
  vec3(0.0, 0.0, 1.0), // 1: SW
  vec3(1.0, 0.0, 1.0), // 2: SE
  vec3(1.0, 0.0, 0.0)  // 3: NE
);

const uint[6] quadIndexToVertexInQuadNumber = uint[6] (
  0U, 1U, 2U,
  0U, 2U, 3U
);
const float normalizedAoValues[4] = float[4](1.0, 0.7, 0.5, 0.3);

const vec3 colorsByBlockId[${allBlockColors.length}] = vec3[${allBlockColors.length}](${allBlockColors.join(',\n')});

ivec2 calculateTextureCoordsForPosition(uint x, uint z) {
  uint chunkX = x / ${GENERIC_CHUNK_SIZE}U;
  uint chunkZ = z / ${GENERIC_CHUNK_SIZE}U;

  uint withinChunkX = x % ${GENERIC_CHUNK_SIZE}U;
  uint withinChunkZ = z % ${GENERIC_CHUNK_SIZE}U;

  uint chunkIndex = chunkZ * ${WorldSizeInChunksUniform} + chunkX;
  uint withinChunkIndex = withinChunkZ * ${GENERIC_CHUNK_SIZE}U + withinChunkX;

  uint absoluteIndex = chunkIndex * (${GENERIC_CHUNK_SIZE}U * ${GENERIC_CHUNK_SIZE}U) + withinChunkIndex;

  uint posX = absoluteIndex % (${GENERIC_CHUNK_SIZE}U * ${WorldSizeInChunksUniform});
  uint posZ = absoluteIndex / (${GENERIC_CHUNK_SIZE}U * ${WorldSizeInChunksUniform});

  return ivec2(uvec2(posX, posZ));
}
`
const vertexMain = (a: any) => `
uint partOfThisQuad = uint(gl_VertexID % 6);
uint quadIndex = uint(gl_VertexID / 6);

uint chunkIndexUnmapped = quadIndex / (${GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE}U);
uint chunkIndexMapped = chunkIndexUnmapped + uint(${a.thisChunkId});
uint chunkX = chunkIndexMapped / (${WorldSizeInChunksUniform});
uint chunkZ = chunkIndexMapped % (${WorldSizeInChunksUniform});
uint quadIndexWithinChunk = quadIndex % (${GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE}U);
uint quadXWithinChunk = quadIndexWithinChunk % ${GENERIC_CHUNK_SIZE}U;
uint quadZWithinChunk = quadIndexWithinChunk / ${GENERIC_CHUNK_SIZE}U;

ivec2 locationWithinChunk  = ivec2(quadXWithinChunk, quadZWithinChunk);
ivec2 chunkAbsoluteLocation = ivec2(chunkX, chunkZ) * ${GENERIC_CHUNK_SIZE};

ivec2 worldLocation = chunkAbsoluteLocation + locationWithinChunk;
ivec2 chunkMappedWorldLocation = calculateTextureCoordsForPosition(uint(worldLocation.x), uint(worldLocation.y));
${a.blockIdHere} = texelFetch(${a.terrainType}, chunkMappedWorldLocation, 0).r;
uint combinedAo = texelFetch(${a.ambientOcclusion}, worldLocation, 0).r;
uint aoForThisVertex = (combinedAo >> (quadIndexToVertexInQuadNumber[partOfThisQuad] * 2U)) & 3U;
${a.aoValueForThisVertex} = normalizedAoValues[aoForThisVertex];

uint heightHere = texelFetch(${a.heightMap}, chunkMappedWorldLocation, 0).r;

vec3 pos = vec3(worldLocation.x, float(heightHere), worldLocation.y) + vertexOffsetsY[quadIndexToVertexInQuadNumber[partOfThisQuad]];
${a.voxelPosition} = pos;

pos.y *= ${TerrainHeightMultiplierUniform};
uint posMask = 0xFFFFU >> 2U;
uint entityId = 1U << 3U; // terrainBit + 3 bits for direction
entityId = (entityId << 14U) | (uint(pos.x) & posMask);
entityId = (entityId << 14U) | (uint(pos.z) & posMask);
${a.entityId} = entityId;
`

const sidesVertexMain = (a: any) => `
uint x = ${a.positionX} & ${0b111_1111_1111_1111}U;
uint z = ${a.positionZ} & ${0b111_1111_1111_1111}U;
uint ao = ((${a.positionX} >> 15U) << 1U) | ((${a.positionZ} >> 15U)) ;

vec3 pos = vec3(x, float(${a.positionY}) * ${TerrainHeightMultiplierUniform}, z);

${a.blockIdHere} = ${a.blockType};
${a.voxelPosition} = vec3(x, ${a.positionY}, z);
${a.aoValueForThisVertex} = normalizedAoValues[ao & 3U];
`

const fragmentMain = (a: any) =>
  `
float distanceFromBorderX =  1.0 - abs(fract(${a.voxelPosition}.x) - 0.5) * 2.0;
float distanceFromBorderY =  1.0 - abs(fract(${a.voxelPosition}.y) - 0.5) * 2.0;
float distanceFromBorderZ =  1.0 - abs(fract(${a.voxelPosition}.z) - 0.5) * 2.0;

float distanceFromBorder = 1.0;
vec2 distanceFactors;
if (distanceFromBorderY == 0.0) 
  distanceFactors = vec2(distanceFromBorderX, distanceFromBorderZ);
if (distanceFromBorderX == 0.0) 
  distanceFactors = vec2(distanceFromBorderY, distanceFromBorderZ);
if (distanceFromBorderZ == 0.0) 
  distanceFactors = vec2(distanceFromBorderY, distanceFromBorderX);

float borderThickness = 0.07;
float smallerDistance = min(distanceFactors.x,distanceFactors.y);
distanceFromBorder = smoothstep(0.8, 1.0, min(borderThickness, smallerDistance) / borderThickness);

float aoLight = pow(${a.aoValueForThisVertex}, 1.2);

vec3 color = colorsByBlockId[${a.blockIdHere}];
vec3 finalColor = color * mix(0.4, 1.0, distanceFromBorder) * aoLight;
uint entityId = ${a.entityId};
`

export const spec = {
  buffers: {
    visibleChunks: { dynamic: true },
    sidesBuffer: { dynamic: false, usesTicketBasedAllocations: true },
    sidesElements: { dynamic: false, element: true },
  },
  textures: {
    terrainType: {
      textureSlot: TextureSlot.TerrainType,
    },
    heightMap: {
      textureSlot: TextureSlot.HeightMap,
    },
    ambientOcclusion: {
      textureSlot: TextureSlot.TerrainTopAmbientOcclusion,
    },
  },
  programs: {
    tops: {
      utilDeclarations,
      vertexMain,
      fragmentMain,
      vertexFinalPosition: 'pos',
      fragmentFinalColor: 'vec4(finalColor.rgb, 1.0)',
      fragmentEntityId: 'entityId',

      textureSamplers: {
        terrainType: {},
        heightMap: {},
        ambientOcclusion: {},
      },
      varyings: {
        blockIdHere: { type: 'uint', flat: true },
        entityId: { type: 'uint', flat: true },
        aoValueForThisVertex: { type: 'float' },
        voxelPosition: { type: 'vec3' },
      },
      attributes: {
        thisChunkId: {
          count: 1,
          type: AttrType.UShort,
          divisor: 1,
          bindTo: { visibleChunks: true },
        },
      },
    },
    sides: {
      utilDeclarations,
      vertexMain: sidesVertexMain,
      vertexFinalPosition: 'pos',
      fragmentMain,
      fragmentFinalColor: 'vec4(finalColor.rgb, 1.0)',
      fragmentEntityId: '0',

      textureSamplers: {
        terrainType: {},
        heightMap: {},
      },
      attributes: {
        positionX: { count: 1, type: AttrType.UShort, bindTo: { sidesBuffer: true } },
        positionZ: { count: 1, type: AttrType.UShort, bindTo: { sidesBuffer: true } },
        blockType: { count: 1, type: AttrType.UByte, bindTo: { sidesBuffer: true } },
        positionY: { count: 1, type: AttrType.UByte, bindTo: { sidesBuffer: true } },
      },
      drawElements: { sidesElements: true },
      uniforms: {},
      varyings: {
        blockIdHere: { type: 'uint', flat: true },
        entityId: { type: 'uint', flat: true },
        aoValueForThisVertex: { type: 'float', flat: false },
        voxelPosition: { type: 'vec3' },
      },
    },
  },
} as const satisfies Spec<any, any, any, 'terrainType' | 'heightMap' | 'ambientOcclusion'>
export type SpecImplementation = ReturnType<typeof createFromSpec<typeof spec>>
