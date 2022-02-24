import { PrecisionHeader, VersionHeader } from '../../shader/common'

export const vertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_position;
in vec3 a_color;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_currentPosition;
flat out vec3 v_normal;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
void main() {
	int flags = int(a_flags);
	v_normal = vec3(ivec3(((flags >> 4) & 3) - 1, ((flags >> 2) & 3) - 1, (flags & 3) - 1));
	v_color = a_color;
	v_currentPosition = a_position;
	vec3 pos = a_position;
	if (pos.y < 1.50) {
		pos.y += sin(u_time * 2.1 + pos.x + pos.z * 100.0) * 0.15 + 0.5;
	}
    gl_Position = u_projection * u_view * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`

export const fragmentShaderSource = `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
flat in vec3 v_normal;
flat in vec3 v_color;
flat in vec3 v_currentPosition;
uniform float u_time;
uniform vec3 u_lightPosition;
const float ambientLight = 0.3;
void main() {
	vec3 normal = v_normal;
	vec3 lightDirection = normalize(u_lightPosition - v_currentPosition);
	float diffuse = max(dot(normal, lightDirection), ambientLight);
	vec3 lightColor = vec3(1,1,1);
	finalColor = vec4(v_color * lightColor * diffuse, 1);
}
`


export const pickViaMouseVertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_position;
in float a_flags;
flat out vec4 v_color;
uniform mat4 u_globalMatrix;
void main() {
	uint a = uint(a_flags);
	uint offsets = a >> 8U;
	uint ox = ((offsets >> 4U) & 3U);
	uint oy = ((offsets >> 2U) & 3U);
	uint oz = ((offsets      ) & 3U);
	uint tmp = (uint(a_position.x) - ox) << (12) | (uint(a_position.z) - oz);
	
	uint r = (tmp >> 16U) & 255U;
	uint g = (tmp >>  8U) & 255U;
	uint b = (tmp       ) & 255U;
	v_color = vec4(r, g, b, a & 255U) / 255.0;
    gl_Position = (u_globalMatrix * vec4(a_position, 1));
}
`

export const pickViaMouseFragmentShader = `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
flat in vec4 v_color;
void main() {
	finalColor = v_color;
}
`

export type Uniforms = 'time' | 'projection' | 'view' | 'lightPosition'
export type Attributes = 'position' | 'color' | 'flags'

export type MousePickerAttributes = 'position' | 'flags'
export type MousePickerUniforms = 'time' | 'globalMatrix'
