import { PrecisionHeader, TerrainHeightMultiplierDeclaration, VersionHeader } from '../../common-shader'
import { MousePickableType } from '../../mouse-picker'

export const vertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
${TerrainHeightMultiplierDeclaration()}
in vec3 a_position;
in vec3 a_color;
in float a_flags;
out vec3 v_vertexPosition;
flat out vec3 v_color;
flat out vec3 v_currentPosition;
flat out vec3 v_normal;
uniform mat4 u_combinedMatrix;
uniform float u_time;
void main() {
	int flags = int(a_flags);
	v_normal = vec3(ivec3(((flags >> 4) & 3) - 1, ((flags >> 2) & 3) - 1, (flags & 3) - 1));
	v_color = a_color;
	v_currentPosition = a_position;
	v_vertexPosition = a_position;
	vec3 pos = a_position;
	if (pos.y < 1.50) {
		pos.y += sin(u_time * 2.1 + pos.x + pos.z * 100.0) * 0.15 + 0.5;
	}
    pos.y *= terrainHeightMultiplier;
    gl_Position = u_combinedMatrix * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`

export const fragmentShaderSource = `${VersionHeader()}
${PrecisionHeader()}
out vec3 finalColor;
in vec3 v_vertexPosition;
flat in vec3 v_normal;
flat in vec3 v_color;
flat in vec3 v_currentPosition;
uniform float u_time;
uniform vec3 u_lightPosition;
const float ambientLight = 0.3;
void main() {
	vec3 normal = v_normal;
	vec3 lightDirection = normalize(u_lightPosition - v_currentPosition);
	float diffuse = clamp(dot(normal, lightDirection), ambientLight, 1.0);
	finalColor = v_color * diffuse;
}
`
export const fragmentShaderSourceWithTileBorders = `${VersionHeader()}
${PrecisionHeader()}
out vec3 finalColor;
in vec3 v_vertexPosition;
flat in vec3 v_normal;
flat in vec3 v_color;
flat in vec3 v_currentPosition;
uniform float u_time;
uniform vec3 u_lightPosition;
const float ambientLight = 0.3;
void main() {
	vec3 normal = v_normal;
	vec3 lightDirection = normalize(u_lightPosition - v_currentPosition);
	float diffuse = clamp(dot(normal, lightDirection), ambientLight, 1.0);
	finalColor = v_color * diffuse;
	
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
	} 
}
`


export const pickViaMouseVertexShaderSource = () => `${VersionHeader()}
${PrecisionHeader()}
${TerrainHeightMultiplierDeclaration()}
in vec3 a_position;
in float a_flags;
flat out vec4 v_color0;
flat out vec3 v_color1;
uniform mat4 u_combinedMatrix;
void main() {
	uint a = uint(a_flags);
	uint offsets = a >> 8U;
	uint ox = ((offsets >> 4U) & 3U);
	uint oy = ((offsets >> 2U) & 3U);
	uint oz = ((offsets      ) & 3U);
	uint x = uint(a_position.x) - ox;
	uint y = uint(a_position.y) - oy;
	uint z = uint(a_position.z) - oz;
	
	v_color0 = vec4((x >> 8U) & 255U, x & 255U, (z >> 8U) & 255U, z & 255U) / 255.0;
	v_color1 = vec3(y & 255U, uint(a_flags) & 255U, ${MousePickableType.Terrain}) / 255.0;
	vec3 pos = a_position;
    pos.y *= terrainHeightMultiplier;
    gl_Position = (u_combinedMatrix * vec4(pos, 1));
}
`

export type Uniforms = 'time' | 'combinedMatrix' | 'lightPosition'
export type Attributes = 'position' | 'color' | 'flags'

export type MousePickerAttributes = 'position' | 'flags'
export type MousePickerUniforms = 'time' | 'combinedMatrix'
