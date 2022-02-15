import { PrecisionHeader, VersionHeader } from '../../shader/common'

export const vertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_position;
in vec3 a_color;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_currentPosition;
flat out int v_flags;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
void main() {
	v_flags = int(a_flags);
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
flat in int v_flags;
flat in vec3 v_color;
flat in vec3 v_currentPosition;
uniform float u_time;
uniform vec3 u_lightPosition;
const float ambientLight = 0.3;
void main() {
	vec3 normal = vec3(ivec3(((v_flags >> 4) & 3) - 1, ((v_flags >> 2) & 3) - 1, (v_flags & 3) - 1));
	vec3 lightDirection = normalize(u_lightPosition - v_currentPosition);
	float diffuse = max(dot(normal, lightDirection), ambientLight);
	// vec3 lightColor = mix(vec3(1,1,0.8), vec3(1,0.57,0.3), sin(u_time * 0.3) * 0.5 + 0.5);
	vec3 lightColor = vec3(1,1,1);
	finalColor = vec4(v_color * lightColor * diffuse, 1);
}
`

export type Uniforms = 'time' | 'projection' | 'view' | 'lightPosition'
export type Attributes = 'position' | 'color' | 'flags'
