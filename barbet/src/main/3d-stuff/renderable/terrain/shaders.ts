import { PrecisionHeader, TerrainHeightMultiplierDeclaration, VersionHeader } from '../../common-shader'
import { MousePickableType } from '../../mouse-picker'

export const vertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
${TerrainHeightMultiplierDeclaration()}
in vec3 a_position;
in vec3 a_color;
in float a_flags;
out vec3 v_vertexPosition;
in float a_ambientOcclusion;
flat out vec3 v_color;
flat out vec3 v_currentPosition;
flat out vec3 v_normal;
out float v_ambientOcclusion;
flat out float v_ambientOcclusionFlat;
flat out vec4 v_ambientOcclusionVec;
uniform mat4 u_combinedMatrix;
uniform float u_time;
void main() {
	int flags = int(a_flags);
	v_normal = vec3(ivec3(((flags >> 4) & ${0b11}) - 1, ((flags >> 2) & ${0b11}) - 1, (flags & ${0b11}) - 1));
	v_ambientOcclusion = (float((flags >> 16) & ${0b1111}) / 7.0);
	v_ambientOcclusionFlat = (float((flags >> 20) & ${0b1111}) / 7.0);


	int ao = int(a_ambientOcclusion);
	v_ambientOcclusionVec = vec4(ivec4((ao >> 0) & ${0b1111}, (ao >> 4) & ${0b1111}, (ao >> 8) & ${0b1111}, (ao >> 12) & ${0b1111})) / 7.0;


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
in float v_ambientOcclusion;
flat in float v_ambientOcclusionFlat;
flat in vec4 v_ambientOcclusionVec;
uniform float u_time;
uniform vec3 u_lightPosition;
const float ambientLight = 0.3;
void main() {
	vec3 normal = v_normal;
	vec3 lightDirection = normalize(u_lightPosition - v_currentPosition);
	float diffuse = clamp(dot(normal, lightDirection), ambientLight, 1.0);


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
	distanceOne = abs(distanceOne - float(int(distanceOne + 0.5))) * 2.0;
	distanceTwo = abs(distanceTwo - float(int(distanceTwo + 0.5))) * 2.0;
	// float distance1 = (sqrt(distanceOne * distanceOne + distanceTwo * distanceTwo) + (distanceOne + distanceTwo) / 4.0) / 2.0;
	// float distance1 = abs(distanceOne * distanceTwo);
	// float distance2 = (sqrt(distanceOne * distanceOne + distanceTwo * distanceTwo));
	float distance3 = min(distanceOne / 2.0, distanceTwo / 2.0);


	// finalColor = v_color * diffuse * (pow(v_ambientOcclusion, 4.0) * 3.0 + v_ambientOcclusionFlat) / 4.0;
	// finalColor = v_color * diffuse * pow(v_ambientOcclusion, 4.0);
	// finalColor = v_color * diffuse * pow(v_ambientOcclusionFlat, 4.0);
	// finalColor = v_color * diffuse * mix(v_ambientOcclusionFlat, pow(v_ambientOcclusion, 4.0), distance3);
	finalColor = v_color * diffuse;

	if (v_normal.y != 0.0) {
		float fx = fract(v_vertexPosition.x);
		float fz = fract(v_vertexPosition.z);

		float maxAo = 0.75;
		float d1 = max(0.0, maxAo - sqrt(fx * fx + fz * fz));
		float d2 = max(0.0, maxAo - sqrt((1.0 - fx) * (1.0 - fx) + fz * fz));
		float d3 = max(0.0, maxAo - sqrt((1.0 - fx) * (1.0 - fx) + (1.0 - fz) * (1.0 - fz)));
		float d4 = max(0.0, maxAo - sqrt(fx * fx + (1.0 - fz) * (1.0 - fz)));


		// float d1 = pow(max(0.0, 1.0 - max(fx, fz)), 2.0);
		// float d2 = pow(max(0.0, 1.0 - max(1.0 - fx, fz)), 2.0);
		// float d3 = pow(max(0.0, 1.0 - max(1.0 - fx, 1.0 - fz)), 2.0);
		// float d4 = pow(max(0.0, 1.0 - max(fx, 1.0 - fz)), 2.0);


		float ao = ((d1 * v_ambientOcclusionVec.z) + (d2 * v_ambientOcclusionVec.y) + (d3 * v_ambientOcclusionVec.x) + (d4 * v_ambientOcclusionVec.w)) / (d1 + d2 + d3 + d4);
		finalColor *= ao;
		// if (v_ambientOcclusionVec.x < 1.0) 
		// if (d3 < 1.0) 
			// finalColor = vec3(1.0,1.0,0.0);
	} else {

	finalColor = vec3(1.0,0.0,0.0);
	}
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
in float a_ambientOcclusion;
flat out vec4 v_color0;
flat out vec3 v_color1;
uniform mat4 u_combinedMatrix;
void main() {
	uint a = uint(a_flags);
	uint offsets = (a >> 8U);
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
export type Attributes = 'position' | 'color' | 'flags' | 'ambientOcclusion'

export type MousePickerAttributes = 'position' | 'flags'
export type MousePickerUniforms = 'time' | 'combinedMatrix'
