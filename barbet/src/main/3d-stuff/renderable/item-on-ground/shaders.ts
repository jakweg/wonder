import { PrecisionHeader, VersionHeader } from '../../common-shader'

export const onGroundVertexShader = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_modelPosition;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition;
uniform mat4 u_combinedMatrix;
uniform float u_time;
void main() {
	int flagsAsInt = int(a_flags);
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	
	v_color = vec3(sin(u_time) * 0.5 + 0.5,sin(u_time * 0.7) * 0.5 + 0.5,sin(u_time * 3.0) * 0.5 + 0.5);
	vec3 pos = a_modelPosition;
    v_currentPosition = pos;
    gl_Position = u_combinedMatrix * vec4(pos, 1);
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
	| 'combinedMatrix'
	| 'lightPosition'
	| 'unitPosition'
	| 'gameTick'
	| 'activityStartTick'
	| 'unitData'
export type Attributes = 'modelPosition' | 'flags'
