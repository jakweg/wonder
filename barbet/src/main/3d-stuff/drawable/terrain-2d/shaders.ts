import {
  GlobalUniformBlockDeclaration,
  PrecisionHeader,
  RenderTimeUniform,
  TerrainHeightMultiplierUniform,
  VersionHeader,
  WorldSizeInChunksUniform,
} from '@3d/common-shader'
import { AttrType } from '@3d/gpu-resources/program'
import { createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { MousePickableType } from '@3d/pipeline/mouse-picker'
import { TextureSlot } from '@3d/texture-slot-counter'
import { allBlocks } from '@game/world/block'
import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from '@game/world/size'

type ShaderOptions = {}

export const vertexShaderSource = (options: ShaderOptions): string => {
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), GlobalUniformBlockDeclaration())
  parts.push(`
uniform usampler2D u_terrainType;
uniform usampler2D u_heightMap;


	flat out uint v_blockIdHere;
	out vec3 v_worldPosition;
	in uint a_thisChunkId;

	const vec3[6] offsets = vec3[6] (
		vec3(0.0, 0.0, 0.0),
		vec3(0.0, 0.0, 1.0),
		vec3(1.0, 0.0, 1.0),

		vec3(1.0, 0.0, 1.0),
		vec3(1.0, 0.0, 0.0),
		vec3(0.0, 0.0, 0.0)
	);
	
	void main() {
		uint partOfThisQuad = uint(gl_VertexID % 6);
		uint quadIndex = uint(gl_VertexID / 6);

		// uint quadX = quadIndex % (${WorldSizeInChunksUniform} * ${GENERIC_CHUNK_SIZE}U);
		// uint quadZ = quadIndex / (${WorldSizeInChunksUniform} * ${GENERIC_CHUNK_SIZE}U);

		uint chunkIndexUnmapped = quadIndex / (${GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE}U);
		uint chunkIndexMapped = chunkIndexUnmapped + uint(a_thisChunkId);
		uint chunkX = chunkIndexMapped / (${WorldSizeInChunksUniform});
		uint chunkZ = chunkIndexMapped % (${WorldSizeInChunksUniform});
		uint quadIndexWithinChunk = quadIndex % (${GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE}U);
		uint quadXWithinChunk = quadIndexWithinChunk % ${GENERIC_CHUNK_SIZE}U;
		uint quadZWithinChunk = quadIndexWithinChunk / ${GENERIC_CHUNK_SIZE}U;

		ivec2 locationWithinChunk  = ivec2(quadXWithinChunk, quadZWithinChunk);
		ivec2 chunkAbsoluteLocation = ivec2(chunkX, chunkZ) * ${GENERIC_CHUNK_SIZE};
		
		ivec2 worldLocation = chunkAbsoluteLocation + locationWithinChunk;
		v_blockIdHere = texelFetch(u_terrainType, worldLocation, 0).r;

		uint heightHere = texelFetch(u_heightMap, worldLocation, 0).r;

		vec3 pos = vec3(worldLocation.x, float(heightHere), worldLocation.y) + offsets[partOfThisQuad];
		v_worldPosition = pos;

		pos.y *= ${TerrainHeightMultiplierUniform};

		gl_Position = u_combinedMatrix * vec4(pos, 1);
		gl_PointSize = 10.0;
	}
	`)

  return parts.join('')
}

export const fragmentShaderSource = (options: ShaderOptions) => {
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), GlobalUniformBlockDeclaration())

  const allBlockColors = allBlocks
    .map(block => [
      (((block.color >> 16) & 0xff) / 255).toFixed(9),
      (((block.color >> 8) & 0xff) / 255).toFixed(9),
      (((block.color >> 0) & 0xff) / 255).toFixed(9),
    ])
    .map(([r, g, b]) => `vec3(${r},${g},${b})`)

  parts.push(
    `
uniform usampler2D u_terrainType;
uniform usampler2D u_heightMap;

	const vec3 colorsByBlockId[${allBlockColors.length}] = vec3[${allBlockColors.length}](${allBlockColors.join(',\n')});

	flat in uint v_blockIdHere;
	in vec3 v_worldPosition;
	out vec3 finalColor;
	
	void main() {
		vec3 positionWithinBlock = vec3(fract(v_worldPosition.x), fract(v_worldPosition.y), fract(v_worldPosition.z));
		float distanceFromBorderX =  1.0 - abs(positionWithinBlock.x - 0.5) * 2.0;
		float distanceFromBorderZ =  1.0 - abs(positionWithinBlock.z - 0.5) * 2.0;
		float distanceFromBorder = smoothstep(0.05, 0.1, distanceFromBorderX) * smoothstep(0.05, 0.1, distanceFromBorderZ);

		vec3 color = colorsByBlockId[v_blockIdHere];
		finalColor = color * mix(0.5, 1.0, distanceFromBorder);
  	}
	`,
  )

  return parts.join('')
}

export type Uniforms = 'terrainType' | 'heightMap'
export type Attributes = 'thisChunkId'

const allBlockColors = /* @__PURE__ */ allBlocks
  .map(block => [
    (((block.color >> 16) & 0xff) / 255).toFixed(9),
    (((block.color >> 8) & 0xff) / 255).toFixed(9),
    (((block.color >> 0) & 0xff) / 255).toFixed(9),
  ])
  .map(([r, g, b]) => `vec3(${r},${g},${b})`)

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
      utilDeclarations: () => `
const vec3[6] offsets = vec3[6] (
	vec3(0.0, 0.0, 0.0),
	vec3(0.0, 0.0, 1.0),
	vec3(1.0, 0.0, 1.0),

	vec3(1.0, 0.0, 1.0),
	vec3(1.0, 0.0, 0.0),
	vec3(0.0, 0.0, 0.0)
);
const vec3 colorsByBlockId[${allBlockColors.length}] = vec3[${allBlockColors.length}](${allBlockColors.join(',\n')});
`,

      vertexMain: a => `
uint partOfThisQuad = uint(gl_VertexID % 6);
uint quadIndex = uint(gl_VertexID / 6);

// uint quadX = quadIndex % (${WorldSizeInChunksUniform} * ${GENERIC_CHUNK_SIZE}U);
// uint quadZ = quadIndex / (${WorldSizeInChunksUniform} * ${GENERIC_CHUNK_SIZE}U);

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
v_blockIdHere = texelFetch(${a.terrainType}, worldLocation, 0).r;

uint heightHere = texelFetch(${a.heightMap}, worldLocation, 0).r;

vec3 pos = vec3(worldLocation.x, float(heightHere), worldLocation.y) + offsets[partOfThisQuad];
v_worldPosition = pos;

pos.y *= ${TerrainHeightMultiplierUniform};
					`,

      vertexFinalPosition: 'pos',

      fragmentMain: a => `
vec3 positionWithinBlock = vec3(fract(${a.worldPosition}.x), fract(${a.worldPosition}.y), fract(${a.worldPosition}.z));
float distanceFromBorderX =  1.0 - abs(positionWithinBlock.x - 0.5) * 2.0;
float distanceFromBorderZ =  1.0 - abs(positionWithinBlock.z - 0.5) * 2.0;
float distanceFromBorder = smoothstep(0.05, 0.1, distanceFromBorderX) * smoothstep(0.05, 0.1, distanceFromBorderZ);

vec3 color = colorsByBlockId[${a.blockIdHere}];
vec3 finalColor = color * mix(0.5, 1.0, distanceFromBorder);
`,
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
