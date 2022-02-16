import { PrecisionHeader, VersionHeader } from '../../shader/common'

export const MASK_PROVOKING = 0b1 << 6
export const FLAG_PROVOKING_BOTTOM = 0b0 << 6
export const FLAG_PROVOKING_TOP = 0b1 << 6

export const MASK_POSITION = 0b11 << 7
export const FLAG_POSITION_BOTTOM = 0b00 << 7
export const FLAG_POSITION_MIDDLE = 0b01 << 7
export const FLAG_POSITION_TOP = 0b10 << 7

export const MASK_BODY_PART = 0b1111 << 9
export const FLAG_PART_MAIN_BODY = 0b0001 << 9
export const FLAG_PART_FACE = 0b1001 << 9
export const MASK_PART_ANY_ARM = 0b0010 << 9
export const MASK_PART_ANY_LEG = 0b0100 << 9
export const FLAG_PART_LEFT = 0b0000 << 9
export const FLAG_PART_RIGHT = 0b0001 << 9
export const FLAG_PART_LEFT_ARM = MASK_PART_ANY_ARM | FLAG_PART_LEFT
export const FLAG_PART_RIGHT_ARM = MASK_PART_ANY_ARM | FLAG_PART_RIGHT
export const FLAG_PART_LEFT_LEG = MASK_PART_ANY_LEG | FLAG_PART_LEFT
export const FLAG_PART_RIGHT_LEG = MASK_PART_ANY_LEG | FLAG_PART_RIGHT

const vertexShaderSourceHead = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_modelPosition;
in vec3 a_worldPosition;
in vec3 a_primaryColor;
in vec3 a_secondaryColor;
in vec3 a_faceColor;
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
	
	if ((flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_FACE}) {
		v_color = a_faceColor;
	} else {
		bool isProvokingTop = (flagsAsInt & ${MASK_PROVOKING}) == ${FLAG_PROVOKING_TOP};
		v_color = (isProvokingTop ? a_secondaryColor : a_primaryColor);
	}
	
	vec3 pos = a_modelPosition;
	bool isMainBodyVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_MAIN_BODY};
	bool isFaceVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_FACE};
	bool isTopVertex = (flagsAsInt & ${MASK_POSITION}) == ${FLAG_POSITION_TOP};
	bool isMiddleVertex = (flagsAsInt & ${MASK_POSITION}) == ${FLAG_POSITION_MIDDLE};
	bool isBottomVertex = (flagsAsInt & ${MASK_POSITION}) == ${FLAG_POSITION_BOTTOM};
	bool isAnimatableElement = (flagsAsInt & ${MASK_PART_ANY_LEG | MASK_PART_ANY_ARM}) > 0;
	bool isLeftArmVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_LEFT_ARM};
	bool isRightArmVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_RIGHT_ARM};
	bool isLeftLegVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_LEFT_LEG};
	bool isRightLegVertex = (flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_RIGHT_LEG};
	
	float computedSin1 = sin(u_time);
	float computedSin5 = sin(u_time * 5.0);
`
const vertexShaderSourceTail = `
	pos *= vec3(0.7, 0.7, 0.7);
	pos += vec3(0.5, 1.1, 0.5) + a_worldPosition;	
    v_currentPosition = pos;
    gl_Position = u_projection * u_view * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`

const pickUpItemShader = `
${vertexShaderSourceHead}
	if (isMainBodyVertex && isTopVertex) {
		pos.z -= computedSin1 * (pos.y + 0.05) * 0.8;
		pos.y += computedSin1 * pos.z * 0.2;
	}
	if (isFaceVertex) {
		pos.z -= computedSin1 * (pos.y + 1.1) * 0.35;
		pos.y -= computedSin1 * pos.y * 0.45;
	}
	if (isMainBodyVertex && isMiddleVertex) {
		pos.z -= computedSin1 * (pos.y + 0.01) * 1.6;
		pos.y += computedSin1 * pos.z * 0.2;
	}
	if (isLeftArmVertex || isRightArmVertex) {
		pos.z -= computedSin1 * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9;
		pos.y -= computedSin1 * 0.4;
	}
${vertexShaderSourceTail}
`

const stationaryShader = `
${vertexShaderSourceHead}
${vertexShaderSourceTail}
`

const idleShader = `
${vertexShaderSourceHead}
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = computedSin1 * (isBottomVertex ? -0.18 : -0.06);
	if (isLeftArmVertex)
		pos.z += additionalZOffset;
	else if (isRightArmVertex)
		pos.z -= additionalZOffset;
}
pos.y += computedSin1 * 0.02;
${vertexShaderSourceTail}
`

const walkingShader = `
${vertexShaderSourceHead}
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = computedSin5 * (isBottomVertex ? -0.2 : -0.1);
	if (isLeftArmVertex || isRightLegVertex)
		pos.z += additionalZOffset;
	else if (isRightArmVertex || isLeftLegVertex)
		pos.z -= additionalZOffset;
}
${vertexShaderSourceTail}
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
	float diffuse = max(sqrt(dot(v_normal, lightDirection)), ambientLight);
	finalColor = vec4(v_color * diffuse, 1);
	// if (!gl_FrontFacing) {
	// 	finalColor = vec4(sin(u_time * 4.0) * 0.5 + 0.5, 0, cos(u_time * 3.0) * 0.5 + 0.5, 1);
	// }
}
`

export type Uniforms = 'time' | 'projection' | 'view' | 'lightPosition'
export type Attributes = 'modelPosition' | 'worldPosition' | 'flags' | 'primaryColor' | 'secondaryColor' | 'faceColor'

export const enum ShaderId {
	Stationary,
	Idle,
	Walking,
	PickUpItem,
}

export const allShaderSources = [
	stationaryShader,
	idleShader,
	walkingShader,
	pickUpItemShader,
]
