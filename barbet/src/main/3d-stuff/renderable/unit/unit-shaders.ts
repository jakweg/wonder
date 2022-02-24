import {
	PIConstantHeader,
	PrecisionHeader,
	RotationMatrix,
	RotationVectorsDeclaration,
	VersionHeader,
} from '../../shader/common'
import { buildShaderColorArray } from './unit-color'

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
${PIConstantHeader()}
${RotationVectorsDeclaration()}
in vec3 a_modelPosition;
in vec3 a_worldPosition;
in float a_colorPaletteId;
in float a_unitRotation;
in float a_flags;
in float a_activityStartTick;
flat out int v_colorPaletteId;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition; 
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
uniform float u_gameTick;

void main() {
	vec3 worldPosition = a_worldPosition;
	int flagsAsInt = int(a_flags);
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	
	if ((flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_FACE}) {
		v_colorPaletteId = int(a_colorPaletteId) * 9 + 6;
	} else {
		bool isProvokingTop = (flagsAsInt & ${MASK_PROVOKING}) == ${FLAG_PROVOKING_TOP};
		v_colorPaletteId = (isProvokingTop ? (int(a_colorPaletteId) * 9 + 3) : int(a_colorPaletteId) * 9);
	}
	
	int unitRotationAsInt = int(a_unitRotation);
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
	float activityDuration = u_gameTick - a_activityStartTick;
	
	float computedSin1 = sin(u_time);
	float computedSin2 = sin(u_time * 2.0);
	float computedSin5 = sin(u_time * 5.0);
`
const vertexShaderSourceTail = `
	pos *= vec3(0.7, 0.7, 0.7);	
    v_currentPosition = pos + worldPosition;
    float a = a_unitRotation * PI / 4.0;
    mat4 rotation = ${RotationMatrix('a')};
    v_normal = (rotation * vec4(v_normal, 1.0)).xyz;
	vec4 posRotated = rotation * vec4(pos, 1);
	posRotated += vec4(0.5, 1.1, 0.5, 0.0) + vec4(worldPosition, 0.0);
    gl_Position = u_projection * u_view * posRotated;
    gl_PointSize = 10.0;
}
`

const pickUpItemShader = `
${vertexShaderSourceHead}
	float usedSin = sin(activityDuration / PI / 1.0);
	if (isMainBodyVertex && isTopVertex) {
		pos.x += usedSin * (pos.y + 0.05) * 0.8;
		pos.y -= usedSin * pos.x * 0.2;
	}
	if (isFaceVertex) {
		pos.x += usedSin * (pos.y + 1.1) * 0.35;
		pos.y -= usedSin * pos.y * 0.45;
	}
	if (isMainBodyVertex && isMiddleVertex) {
		pos.x += usedSin * (pos.y + 0.01) * 1.6;
		pos.y -= usedSin * pos.x * 0.2;
	}
	if (isLeftArmVertex || isRightArmVertex) {
		bool isPhaseOne = activityDuration < 5.0; 
		if (isPhaseOne)
			pos.x += usedSin * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9;
		else
			pos.x += sin(5.0 / PI / 1.0) * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9 - cos(activityDuration / PI / 1.0) * -0.5;
		pos.y -= usedSin * 0.4;
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
	float additionalZOffset = computedSin2 * (isBottomVertex ? -0.18 : -0.06);
	if (isLeftArmVertex)
		pos.x -= additionalZOffset;
	else if (isRightArmVertex)
		pos.x += additionalZOffset;
}
pos.y += computedSin1 * 0.02;
${vertexShaderSourceTail}
`

const idleHoldingItemShader = `
${vertexShaderSourceHead}
if (isLeftArmVertex || isRightArmVertex) {
	pos.x += sin(5.0 / PI / 1.0) * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9 - cos(10.0 / PI / 1.0) * -0.5;
}
pos.y += computedSin1 * 0.02;
${vertexShaderSourceTail}
`

const walkingShader = `
${vertexShaderSourceHead}
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = sin(u_time * 20.0 / PI) * (isBottomVertex ? -0.2 : -0.1);
	if (isLeftArmVertex || isRightLegVertex)
		pos.x -= additionalZOffset;
	else if (isRightArmVertex || isLeftLegVertex)
		pos.x += additionalZOffset;
}
worldPosition += rotationVectors[unitRotationAsInt] * activityDuration / 15.0;
${vertexShaderSourceTail}
`

const walkingHoldingItemShader = `
${vertexShaderSourceHead}
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = sin(u_time * 20.0 / PI) * (isBottomVertex ? -0.2 : -0.1);
	if (isRightLegVertex)
		pos.x -= additionalZOffset;
	else if (isLeftLegVertex)
		pos.x += additionalZOffset;
}
if (isLeftArmVertex || isRightArmVertex) {
	pos.x += sin(5.0 / PI / 1.0) * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9 - cos(10.0 / PI / 1.0) * -0.5;
}
worldPosition += rotationVectors[unitRotationAsInt] * activityDuration / 15.0;
${vertexShaderSourceTail}
`

export const fragmentShaderSource = `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
flat in int v_colorPaletteId;
flat in vec3 v_normal;
flat in vec3 v_currentPosition;
uniform float u_time;
uniform vec3 u_lightPosition;
const float ambientLight = 0.5;
${buildShaderColorArray('unitColors')}
void main() {
	vec3 lightDirection = normalize(vec3(u_lightPosition) - v_currentPosition);
	float diffuse = max(sqrt(dot(v_normal, lightDirection)), ambientLight);
	vec3 color = vec3(unitColors[v_colorPaletteId], unitColors[v_colorPaletteId + 1], unitColors[v_colorPaletteId + 2]);
	finalColor = vec4(color * diffuse, 1);
	// if (!gl_FrontFacing) {
	// 	finalColor = vec4(sin(u_time * 4.0) * 0.5 + 0.5, 0, cos(u_time * 3.0) * 0.5 + 0.5, 1);
	// }
}
`

export type Uniforms = 'time' | 'projection' | 'view' | 'lightPosition' | 'gameTick'
export type Attributes =
	'modelPosition'
	| 'worldPosition'
	| 'flags'
	| 'colorPaletteId'
	| 'activityStartTick'
	| 'unitRotation'

export const enum ShaderId {
	Stationary,
	Idle,
	Walking,
	PickUpItem,
	IdleHoldingItem,
	WalkingHoldingItem,
}

export const allShaderSources = [
	stationaryShader,
	idleShader,
	walkingShader,
	pickUpItemShader,
	idleHoldingItemShader,
	walkingHoldingItemShader,
]

Object.freeze(allShaderSources)
