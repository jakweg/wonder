import {
  GlobalUniformBlockDeclaration,
  PrecisionHeader,
  RenderTimeUniform,
  TerrainHeightMultiplierUniform,
  VersionHeader,
  WorldSizeInChunksUniform,
} from '@3d/common-shader'
import { MousePickableType } from '@3d/pipeline/mouse-picker'
import { allBlocks } from '@game/world/block'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'

type ShaderOptions = {}

export const vertexShaderSource = (options: ShaderOptions): string => {
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), GlobalUniformBlockDeclaration())
  parts.push(`
	uniform usampler2D u_terrainType;
	uniform usampler2D u_heightMap;
	flat out uint v_blockIdHere;

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

		uint quadX = quadIndex % (${WorldSizeInChunksUniform} * ${GENERIC_CHUNK_SIZE}U);
		uint quadZ = quadIndex / (${WorldSizeInChunksUniform} * ${GENERIC_CHUNK_SIZE}U);

		ivec2 worldLocation = ivec2(quadX, quadZ);
		v_blockIdHere = texelFetch(u_terrainType, worldLocation, 0).r;

		uint heightHere = texelFetch(u_heightMap, worldLocation, 0).r;


		vec3 pos = vec3(worldLocation.x, float(heightHere) * ${TerrainHeightMultiplierUniform}, worldLocation.y) + offsets[partOfThisQuad];

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
	const vec3 colorsByBlockId[${allBlockColors.length}] = vec3[${allBlockColors.length}](${allBlockColors.join(',\n')});

	flat in uint v_blockIdHere;
	out vec3 finalColor;
	
	void main() {
		vec3 color = colorsByBlockId[v_blockIdHere];
		finalColor = color;
  	}
	`,
  )

  return parts.join('')
}

export type Uniforms = 'terrainType' | 'heightMap'
export type Attributes = never
