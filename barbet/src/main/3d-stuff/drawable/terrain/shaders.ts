import {
  GlobalUniformBlockDeclaration,
  PrecisionHeader,
  RenderTimeUniform,
  TerrainHeightMultiplierDeclaration,
  VersionHeader,
} from '../../common-shader'
import { MousePickableType } from '../../pipeline/mouse-picker'

interface ShaderOptions {
  ambientOcclusion: boolean
  tileBorders: boolean
  forMousePicker: boolean
}

const ambientOcclusionDarknessLevels = [0, 6, 10, 12, 14, 15, 15, 15]

export const vertexShaderSource = (options: ShaderOptions): string => {
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), TerrainHeightMultiplierDeclaration(), GlobalUniformBlockDeclaration())
  parts.push(`
	in vec3 a_position;
	in vec3 a_color;
	in uint a_offsets;
	in uint a_flags;
	out vec3 v_vertexPosition;
	in uint a_ambientOcclusion;
	`)
  if (options.forMousePicker) parts.push(`flat out vec4 v_color0; flat out vec3 v_color1;`)
  else
    parts.push(`
	flat out vec3 v_color;
	flat out vec3 v_normal;
	flat out vec4 v_ambientOcclusionVec;
	`)

  parts.push(`
	uniform vec2 u_chunkPosition;
	const float darknessLevels[] = float[](${ambientOcclusionDarknessLevels.map(e => (e / 15.0).toFixed(8)).join(',')});
	
	void main() {
		int flags = int(a_flags);
	`)

  if (options.ambientOcclusion && !options.forMousePicker)
    parts.push(`
			int ao = int(a_ambientOcclusion);
			v_ambientOcclusionVec = vec4(darknessLevels[(ao >> 0) & ${0b1111}], darknessLevels[(ao >> 4) & ${0b1111}], darknessLevels[(ao >> 8) & ${0b1111}], darknessLevels[(ao >> 12) & ${0b1111}]);
		`)

  if (options.forMousePicker)
    parts.push(`
		uint a = uint(a_flags);
		uint offsets = a_offsets;
		uint ox = ((offsets >> 4U) & 3U);
		uint oy = ((offsets >> 2U) & 3U);
		uint oz = ((offsets      ) & 3U);
		uint x = uint(a_position.x + u_chunkPosition.x) - ox;
		uint y = uint(a_position.y) - oy;
		uint z = uint(a_position.z + u_chunkPosition.y) - oz;
		
		v_color0 = vec4((x >> 8U) & 255U, x & 255U, (z >> 8U) & 255U, z & 255U) / 255.0;
		v_color1 = vec3(y & 255U, uint(a_flags) & 255U, ${MousePickableType.Terrain}) / 255.0;`)
  else
    parts.push(`
vec3 normal = v_normal = vec3(ivec3(((flags >> 4) & ${0b11}) - 1, ((flags >> 2) & ${0b11}) - 1, (flags & ${0b11}) - 1));
float directionalLight = clamp(dot(normal, u_light.xyz), u_light.w, 1.0);
v_color = a_color.zyx;
v_color = mix(v_color, v_color * directionalLight, 0.8);
v_vertexPosition = a_position + vec3(u_chunkPosition.x, 0.0, u_chunkPosition.y);
`)

  parts.push(`
		vec3 pos = a_position;
		if (pos.y < 1.50) {
			pos.y += sin(${RenderTimeUniform} * 2.1 + pos.x + pos.z * 100.0) * 0.15 + 0.5;
		}
		pos.x += u_chunkPosition.x;
		pos.z += u_chunkPosition.y;
		pos.y *= terrainHeightMultiplier;
		gl_Position = u_combinedMatrix * vec4(pos, 1);
		gl_PointSize = 10.0;
	}
	`)

  return parts.join('')
}

export const fragmentShaderSource = (options: ShaderOptions) => {
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), GlobalUniformBlockDeclaration())
  parts.push(
    `
	out vec3 finalColor;
	in vec3 v_vertexPosition;
	flat in vec3 v_normal;
	flat in vec3 v_color;
	flat in vec4 v_ambientOcclusionVec;
	
	float calculateAmbientOcclusion(vec2 vertex, vec4 ambientValues) {
		float fx = fract(vertex.x);
		float fz = fract(vertex.y);
	` +
      // `
      // 	float maxAo = 0.75;
      // 	float d1 = max(0.0, maxAo - sqrt(fx * fx + fz * fz));
      // 	float d2 = max(0.0, maxAo - sqrt((1.0 - fx) * (1.0 - fx) + fz * fz));
      // 	float d3 = max(0.0, maxAo - sqrt((1.0 - fx) * (1.0 - fx) + (1.0 - fz) * (1.0 - fz)));
      // 	float d4 = max(0.0, maxAo - sqrt(fx * fx + (1.0 - fz) * (1.0 - fz)));
      // ` +
      `
		float power = 2.0;
		float d1 = pow(1.0 - max(fx, fz), power);
		float d2 = pow(1.0 - max(1.0 - fx, fz), power);
		float d3 = pow(1.0 - max(1.0 - fx, 1.0 - fz), power);
		float d4 = pow(1.0 - max(fx, 1.0 - fz), power);
	
		return ((d1 * ambientValues.x) + (d2 * ambientValues.y) + (d3 * ambientValues.z) + (d4 * ambientValues.w)) / (d1 + d2 + d3 + d4);
	}
	
	void main() {
	`,
  )
  if (options.ambientOcclusion && !options.forMousePicker)
    parts.push(`
		vec2 aoVertex;
		vec4 aoVec;
	
		if (v_normal.x > 0.0) {
			aoVertex = v_vertexPosition.yz;
			aoVec = v_ambientOcclusionVec.xywz;
		} else if (v_normal.x < 0.0) {
			aoVertex = v_vertexPosition.yz;
			aoVec = v_ambientOcclusionVec.xwzy;
		} else if (v_normal.z < 0.0) {
			aoVertex = v_vertexPosition.xy;
			aoVec = v_ambientOcclusionVec.xzwy;
		} else if (v_normal.z > 0.0) {
			aoVertex = v_vertexPosition.xy;
			aoVec = v_ambientOcclusionVec.xywz;
		} else {
			aoVertex = v_vertexPosition.xz;
			aoVec = v_ambientOcclusionVec.zyxw;
		}
		float ao = calculateAmbientOcclusion(aoVertex, aoVec);
		`)
  else parts.push('float ao = 1.0;')

  parts.push(`
		finalColor = v_color * ao;
	`)

  if (options.tileBorders && !options.forMousePicker)
    parts.push(`
	float distanceOne;
	float distanceTwo;
	if (v_normal.y != 0.0) {
		distanceOne = v_vertexPosition.x;
		distanceTwo = v_vertexPosition.z;
	} else if (v_normal.x != 0.0) {
		distanceOne = v_vertexPosition.y;
		distanceTwo = v_vertexPosition.z;
	} else {
		distanceOne = v_vertexPosition.x;
		distanceTwo = v_vertexPosition.y;
	}
	distanceOne = abs(distanceOne - float(int(distanceOne + 0.5)));
	distanceTwo = abs(distanceTwo - float(int(distanceTwo + 0.5)));
	float smallerDistance = min(distanceOne, distanceTwo);
	if (smallerDistance < 0.03) {
		float tmp = 33.0;
		float multiply = (smallerDistance * smallerDistance) * (tmp * tmp) * 0.3 + 0.7;
		finalColor.r *= multiply;
		finalColor.g *= multiply;
		finalColor.b *= multiply;
	}`)

  parts.push(`}`)

  return parts.join('')
}

export type Uniforms = 'chunkPosition'
export type Attributes = 'position' | 'color' | 'flags' | 'ambientOcclusion' | 'offsets'

export type MousePickerAttributes = 'position' | 'flags'
export type MousePickerUniforms = 'chunkPosition'
