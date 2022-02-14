import { PrecisionHeader, VersionHeader } from '../shader/common'

export const MASK_PROVOKING = 0b1 << 6
export const FLAG_PROVOKING_BOTTOM = 0b0 << 6
export const FLAG_PROVOKING_TOP = 0b1 << 6

export const MASK_POSITION = 0b11 << 7
export const FLAG_POSITION_BOTTOM = 0b00 << 7
export const FLAG_POSITION_MIDDLE = 0b01 << 7
export const FLAG_POSITION_TOP = 0b10 << 7

export const MASK_BODY_PART = 0b111 << 9
export const FLAG_PART_MAIN_BODY = 0b001 << 9
export const FLAG_PART_LEFT_ARM = 0b010 << 9
export const FLAG_PART_RIGHT_ARM = 0b011 << 9
export const MASK_PART_ANY_ARM = 0b010 << 9


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
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	
	bool isProvokingTop = (flagsAsInt & ${MASK_PROVOKING}) == ${FLAG_PROVOKING_TOP};
	v_color = (isProvokingTop ? a_secondaryColor : a_primaryColor);
	
	bool isTopVertex = (flagsAsInt & ${MASK_POSITION}) == ${FLAG_POSITION_TOP};
	bool isBottomVertex = (flagsAsInt & ${MASK_POSITION}) == ${FLAG_POSITION_BOTTOM};
	bool isLeftArmVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_LEFT_ARM};
	bool isRightArmVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_RIGHT_ARM};
	
	vec3 pos = a_modelPosition;
	if (isLeftArmVertex) {
		pos.z += cos(u_time * 2.0) * (isTopVertex ? 0.0 : (isBottomVertex ? -0.2 : -0.1));
	} else if (isRightArmVertex) {
		pos.z -= cos(u_time * 2.0) * (isTopVertex ? 0.0 : (isBottomVertex ? -0.2 : -0.1));
	}
	pos *= vec3(0.7, 0.8, 0.7);
	pos += vec3(0.5,2,0.5) + a_worldPosition;	
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
