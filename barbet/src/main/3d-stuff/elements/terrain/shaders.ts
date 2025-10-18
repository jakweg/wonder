import { TerrainHeightMultiplierUniform, WorldSizeInChunksUniform } from '@3d/common-shader'
import { AttrType } from '@3d/gpu-resources/program'
import { createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { TextureSlot } from '@3d/texture-slot-counter'
import { allBlocks, BlockId } from '@game/world/block'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'

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

const ivec3[4] vertexOffsetsX = ivec3[4] (
  ivec3(1, 0, 0), // 0: Bottom-Left
  ivec3(1, 1, 0), // 1: Top-Left
  ivec3(1, 1, 1), // 2: Top-Right
  ivec3(1, 0, 1)  // 3: Bottom-Right
);

const ivec3[4] vertexOffsetsZ = ivec3[4] (
  ivec3(0, 0, 1), // 0: Bottom-Left
  ivec3(0, 1, 1), // 1: Top-Left
  ivec3(1, 1, 1), // 2: Top-Right
  ivec3(1, 0, 1)  // 3: Bottom-Right
);

const uint[6] quadIndexToVertexInQuadNumber = uint[6] (
  0U, 1U, 2U,
  0U, 2U, 3U
);
const uint[6] quadIndexToVertexInQuadNumberFlipped = uint[6] (
  2U, 1U, 0U,
  2U, 0U, 3U
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
${a.positionOnOneAxis} = vec2(pos.x, pos.z);

pos.y *= ${TerrainHeightMultiplierUniform};
${a.finalPosition} = pos;
uint posMask = 0xFFFFU >> 2U;
uint entityId = 1U << 3U; // terrainBit + 3 bits for direction
entityId = (entityId << 14U) | (uint(pos.x) & posMask);
entityId = (entityId << 14U) | (uint(pos.z) & posMask);
${a.entityId} = entityId;
`
const fragmentMain = (isForTops: boolean) => (a: any) =>
  `
vec2 positionWithinBlock = vec2(fract(${a.positionOnOneAxis}.x), fract(${a.positionOnOneAxis}.y));
float distanceFromBorderX =  1.0 - abs(positionWithinBlock.x - 0.5) * 2.0;
float distanceFromBorderZ =  1.0 - abs(positionWithinBlock.y - 0.5) * 2.0;
float lineThicknessMultiplier = ${isForTops ? '1.0' : TerrainHeightMultiplierUniform};
float distanceFromBorder = smoothstep(0.02 / lineThicknessMultiplier, 0.05 / lineThicknessMultiplier, distanceFromBorderX) 
                         * smoothstep(0.02,                           0.05, distanceFromBorderZ);

float ao = pow(${a.aoValueForThisVertex}, 0.8);

vec3 color = colorsByBlockId[${a.blockIdHere}];
vec3 finalColor = color * mix(0.5, 1.0, distanceFromBorder) * ao;
uint entityId = ${a.entityId};
`

export const spec = {
  buffers: {
    visibleChunks: { dynamic: true },
    sidesBuffer: { dynamic: false },
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
    default: {
      utilDeclarations,
      vertexMain,
      fragmentMain: fragmentMain(true),
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
        positionOnOneAxis: { type: 'vec2' },
        entityId: { type: 'uint', flat: true },
        aoValueForThisVertex: { type: 'float' },
        finalPosition: { type: 'vec3' },
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
    instancedSides: {
      utilDeclarations,
      vertexMain: a => `
uint partOfThisQuad = uint(gl_VertexID % 6);
bool isXSide   = (${a.quadIndex1} & 128U) == 128U;
bool needsFlip = (${a.quadIndex1} &  64U) == 64U;
uint quadIndexWithinChunk = ((${a.quadIndex1} & 15U) << 8U) | ${a.quadIndex2};

ivec2 worldLocation = ivec2(quadIndexWithinChunk % ${GENERIC_CHUNK_SIZE}U, quadIndexWithinChunk / ${GENERIC_CHUNK_SIZE}U);

// ivec2 chunkMappedWorldLocation = calculateTextureCoordsForPosition(uint(worldLocation.x), uint(worldLocation.y));
// uint heightHere = texelFetch(${a.heightMap}, chunkMappedWorldLocation, 0).r;



ivec3 intPosition = ivec3(worldLocation.x, 0, worldLocation.y);
uint quadIndex = needsFlip ? quadIndexToVertexInQuadNumberFlipped[partOfThisQuad] : quadIndexToVertexInQuadNumber[partOfThisQuad];
intPosition += isXSide ? vertexOffsetsX[quadIndex] : vertexOffsetsZ[quadIndex];
intPosition.y += int(${a.trueBottom});


// if (needsFlip) intPosition = ivec3(0,0,0);







// ivec3 intPosition = ivec3(worldLocation.x, 0.0, worldLocation.y) 
//     + (isXSide ? vertexOffsetsX[quadIndexToVertexInQuadNumber[partOfThisQuad]] : vertexOffsetsZ[quadIndexToVertexInQuadNumber[partOfThisQuad]]);

// if (intPosition.y == 0)
//   intPosition.y = int(${a.trueBottom});
// else
//   intPosition.y = int(heightHere);

// float y_top = float(max(heightHere, ${a.trueBottom}));
// float y_bottom = float(min(heightHere, ${a.trueBottom}));

// vec3 baseOffset = isXSide 
//     ? vertexOffsetsX[quadIndexToVertexInQuadNumber[partOfThisQuad]] 
//     : vertexOffsetsZ[quadIndexToVertexInQuadNumber[partOfThisQuad]];

// ivec3 intPosition = ivec3(worldLocation.x, 0, worldLocation.y) + ivec3(baseOffset);

// // If baseOffset.y is 1, it's a top vertex -> use y_top
// // If baseOffset.y is 0, it's a bottom vertex -> use y_bottom
// intPosition.y = (baseOffset.y == 1.0) ? int(y_top) : int(y_bottom);

${a.positionOnOneAxis} = vec2(float(intPosition.y), isXSide ? intPosition.z : intPosition.x);

// bool needsOffsetBlockId = ${a.trueBottom} > heightHere;
// uint xBlockIdOffset = (needsOffsetBlockId && isXSide) ? 1U : 0U;
// uint zBlockIdOffset = (needsOffsetBlockId && !isXSide) ? 1U : 0U;

// ivec2 blockIdPos = calculateTextureCoordsForPosition(uint(worldLocation.x) + xBlockIdOffset, uint(worldLocation.y) + zBlockIdOffset);
// ${a.blockIdHere} = texelFetch(${a.terrainType}, blockIdPos, 0).r;
${a.blockIdHere} = ${BlockId.Gravel}U;

vec3 worldPosition = vec3(intPosition.x, float(intPosition.y) * ${TerrainHeightMultiplierUniform}, intPosition.z);
${a.finalPosition} = worldPosition;

${a.aoValueForThisVertex} = normalizedAoValues[(${a.aoByte} >> (quadIndexToVertexInQuadNumber[partOfThisQuad] * 2U)) & 3U];
      `,
      vertexFinalPosition: 'worldPosition',
      fragmentMain: fragmentMain(false),
      fragmentFinalColor: 'vec4(finalColor.rgb, 1.0)',
      fragmentEntityId: '0',

      textureSamplers: {
        terrainType: {},
        heightMap: {},
      },
      attributes: {
        quadIndex1: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { sidesBuffer: true } },
        quadIndex2: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { sidesBuffer: true } },
        trueBottom: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { sidesBuffer: true } },
        aoByte: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { sidesBuffer: true } },
      },
      uniforms: {},
      varyings: {
        blockIdHere: { type: 'uint', flat: true },
        positionOnOneAxis: { type: 'vec2' },
        entityId: { type: 'uint', flat: true },
        aoValueForThisVertex: { type: 'float' },
        finalPosition: { type: 'vec3' },
      },
    },
  },
} as const satisfies Spec<any, any, any, 'terrainType' | 'heightMap' | 'ambientOcclusion'>
export type SpecImplementation = ReturnType<typeof createFromSpec<typeof spec>>
