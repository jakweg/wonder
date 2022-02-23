import { PrecisionHeader, VersionHeader } from '../../shader/common'

export const onGroundVertexShader = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_modelPosition;
in vec3 a_worldPosition;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
void main() {
	int flagsAsInt = int(a_flags);
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	
	v_color = vec3(1,0,0);
	vec3 pos = a_modelPosition;
	pos *= vec3(0.6);
	pos += vec3(0.5, 0.5, 0.5) + a_worldPosition;	
    v_currentPosition = pos;
    gl_Position = u_projection * u_view * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`

export const inHandVertexShader = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_modelPosition;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition;
uniform vec3 u_unitPosition;
uniform float u_activityStartTick;
uniform int u_moving;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
uniform float u_gameTick;
void main() {
	int flagsAsInt = int(a_flags);
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	
	v_color = vec3(1,0,0);
	vec3 pos = a_modelPosition;
	pos *= vec3(0.6);
	float activityDuration = u_gameTick - u_activityStartTick;
	pos += vec3(0.5, 0.8, -0.1) + (u_unitPosition - vec3(0,0, activityDuration) / 15.0 * float(u_moving));	
    v_currentPosition = pos;
    gl_Position = u_projection * u_view * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`

export const itemFragmentShaderSource = `${VersionHeader()}
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
	float diffuse = max(sqrt(dot(v_normal, lightDirection)), ambientLight);
	finalColor = vec4(v_color * diffuse, 1);
}
`

export type Uniforms =
	'time'
	| 'projection'
	| 'view'
	| 'lightPosition'
	| 'unitPosition'
	| 'gameTick'
	| 'activityStartTick'
	| 'moving'
export type Attributes = 'worldPosition' | 'modelPosition' | 'flags'
