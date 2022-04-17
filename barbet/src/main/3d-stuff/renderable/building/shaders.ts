import { PrecisionHeader, VersionHeader } from '../../common-shader'

export const vertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
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
    gl_Position = u_combinedMatrix * vec4(a_position, 1);
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
const vec3 lightPosition = vec3(300.0, 250.0, -500.0);
const float ambientLight = 0.3;
void main() {
	vec3 normal = v_normal;
	vec3 lightDirection = normalize(lightPosition - v_currentPosition);
	float diffuse = clamp(dot(normal, lightDirection), ambientLight, 1.0);
	finalColor = v_color * diffuse;
}
`


export type Uniforms = 'time' | 'combinedMatrix'
export type Attributes = 'position' | 'color' | 'flags'

