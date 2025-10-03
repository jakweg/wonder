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
	flat out uint v_blockIdHere;
	out vec3 v_worldPosition;

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
export type Attributes = never
