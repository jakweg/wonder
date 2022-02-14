import { PrecisionHeader, VersionHeader } from '../shader/common'

export const FLAG_BOTTOM = 0b000000000
export const FLAG_TOP = 0b001000000
const FLAG_TOP_BOTTOM_MASK = 0b001000000

export const vertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_modelPosition;
in vec3 a_worldPosition;
in vec3 a_primaryColor;
in vec3 a_secondaryColor;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition; 
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
void main() {
	int flagsAsInt = int(a_flags);
	bool isTop = (flagsAsInt & ${FLAG_TOP_BOTTOM_MASK}) == ${FLAG_TOP};
	v_color = (isTop ?  a_secondaryColor :a_primaryColor);
	
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	
	vec3 pos = (a_modelPosition * vec3(0.7, 0.8, 0.7) + vec3(0.5,0,0.5)) + a_worldPosition;
	pos.x += cos(u_time);	
	pos.z += sin(u_time);	
    v_currentPosition = pos;
    gl_Position = u_projection * u_view * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`

export const fragmentShaderSource = `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
flat in vec3 v_color;
flat in vec3 v_normal;
flat in vec3 v_currentPosition;
uniform float u_time;
uniform vec3 u_lightPosition;
const float ambientLight = 0.5;
void main() {
	vec3 lightDirection = normalize(vec3(u_lightPosition) - v_currentPosition);
	// vec3 lightDirection = normalize(vec3(u_lightPosition.x, v_currentPosition.y + 1.0, u_lightPosition.z) - v_currentPosition);
	float diffuse = max(sqrt(dot(v_normal, lightDirection)), ambientLight);
	finalColor = vec4(v_color * diffuse, 1);
	// if (!gl_FrontFacing) {
	// 	finalColor = vec4(sin(u_time * 4.0) * 0.5 + 0.5, 0, cos(u_time * 3.0) * 0.5 + 0.5, 1);
	// }
}
`

export type Uniforms = 'time' | 'projection' | 'view' | 'lightPosition'
export type Attributes = 'modelPosition' | 'worldPosition' | 'flags' | 'primaryColor' | 'secondaryColor'
