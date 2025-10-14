import { TerrainHeightMultiplierUniform, WorldSizeInChunksUniform } from '@3d/common-shader'
import { AttrType } from '@3d/gpu-resources/program'
import { createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { TextureSlot } from '@3d/texture-slot-counter'
import { allBlocks } from '@game/world/block'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'

const allBlockColors = /* @__PURE__ */ allBlocks
  .map(block => [
    (((block.color >> 16) & 0xff) / 255).toFixed(9),
    (((block.color >> 8) & 0xff) / 255).toFixed(9),
    (((block.color >> 0) & 0xff) / 255).toFixed(9),
  ])
  .map(([r, g, b]) => `vec3(${r},${g},${b})`)

const utilDeclarations = () => `
const vec3[6] offsets = vec3[6] (
	vec3(0.0, 0.0, 0.0),
	vec3(0.0, 0.0, 1.0),
	vec3(1.0, 0.0, 1.0),

	vec3(1.0, 0.0, 1.0),
	vec3(1.0, 0.0, 0.0),
	vec3(0.0, 0.0, 0.0)
);
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

uint heightHere = texelFetch(${a.heightMap}, chunkMappedWorldLocation, 0).r;

vec3 pos = vec3(worldLocation.x, float(heightHere), worldLocation.y) + offsets[partOfThisQuad];
v_worldPosition = pos;

pos.y *= ${TerrainHeightMultiplierUniform};
`
const fragmentMain = (a: any) => `
vec3 positionWithinBlock = vec3(fract(${a.worldPosition}.x), fract(${a.worldPosition}.y), fract(${a.worldPosition}.z));
float distanceFromBorderX =  1.0 - abs(positionWithinBlock.x - 0.5) * 2.0;
float distanceFromBorderZ =  1.0 - abs(positionWithinBlock.z - 0.5) * 2.0;
float distanceFromBorder = smoothstep(0.05, 0.1, distanceFromBorderX) * smoothstep(0.05, 0.1, distanceFromBorderZ);

vec3 color = colorsByBlockId[${a.blockIdHere}];
vec3 finalColor = color * mix(0.5, 1.0, distanceFromBorder);
`

export const spec = {
  buffers: { visibleChunks: { dynamic: true } },
  textures: {
    terrainType: {
      textureSlot: TextureSlot.TerrainType,
    },
    heightMap: {
      textureSlot: TextureSlot.HeightMap,
    },
  },
  programs: {
    default: {
      utilDeclarations,
      vertexMain,
      fragmentMain,
      vertexFinalPosition: 'pos',
      fragmentFinalColor: 'vec4(finalColor.rgb, 1.0)',

      textureSamplers: {
        terrainType: {},
        heightMap: {},
      },
      varyings: {
        blockIdHere: { type: 'uint', flat: true },
        worldPosition: { type: 'vec3' },
      },
      attributes: {
        thisChunkId: { count: 1, type: AttrType.UShort, divisor: 1, bindTo: { visibleChunks: true } },
      },
    },
  },
} as const satisfies Spec<any, any, any, 'terrainType' | 'heightMap'>
export type SpecImplementation = ReturnType<typeof createFromSpec<typeof spec>>
