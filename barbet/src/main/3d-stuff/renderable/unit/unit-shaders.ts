import { Direction } from '../../../util/direction'
import { idleVertexTransformationsSource } from '../../game-state/activities/idle'
import { itemPickUpTransformationsSource } from '../../game-state/activities/item-pickup'
import { walkingVertexTransformationsSource } from '../../game-state/activities/walking'
import { MousePickableType } from '../../mouse-picker'
import {
	PIConstantHeader,
	PrecisionHeader,
	RotationMatrix,
	RotationVectorsDeclaration,
	VersionHeader,
	WalkingDurationsByRotation,
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

export const constructUnitVertexShaderSource = (transformations: string,
                                                {forMousePicker}: UnitShaderCreationOptions): string => {
	const parts: string[] = [VersionHeader(),
		PrecisionHeader(),
		PIConstantHeader(),
		RotationVectorsDeclaration(),
		WalkingDurationsByRotation()]

	parts.push(`
in vec3 a_modelPosition;
in vec3 a_worldPosition;
in float a_unitRotation;
in float a_flags;
in float a_activityStartTick;
uniform float u_time;
uniform float u_gameTime;
uniform float u_gameTick;
`)
	if (forMousePicker) parts.push(`
uniform mat4 u_combinedMatrix;
flat out vec4 v_color0;
flat out vec3 v_color1;
in float a_unitId;
`)
	else parts.push(`
uniform mat4 u_combinedMatrix;
in float a_colorPaletteId;
flat out vec3 v_currentPosition;
flat out int v_colorPaletteId;
flat out vec3 v_normal;
`)


	parts.push(`
void main() {
	vec3 worldPosition = a_worldPosition;
	int flagsAsInt = int(a_flags);
`)
	if (!forMousePicker)
		parts.push(`
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	if ((flagsAsInt & ${MASK_BODY_PART}) == ${FLAG_PART_FACE}) {
		v_colorPaletteId = int(a_colorPaletteId) * 9 + 6;
	} else {
		bool isProvokingTop = (flagsAsInt & ${MASK_PROVOKING}) == ${FLAG_PROVOKING_TOP};
		v_colorPaletteId = (isProvokingTop ? (int(a_colorPaletteId) * 9 + 3) : int(a_colorPaletteId) * 9);
	}
	`)

	parts.push(`
	int tmpIRotation = int(a_unitRotation);
	int unitRotationAsInt = tmpIRotation & ${Direction.MaskCurrentRotation};
	bool mergeRotations = ((tmpIRotation & ${Direction.MaskMergePrevious}) == ${Direction.FlagMergeWithPrevious});
	int unitPreviousRotation = (mergeRotations ? ((tmpIRotation & ${Direction.MaskPreviousRotation}) >> 3) : (unitRotationAsInt));
	
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
		`)

	parts.push(transformations)

	parts.push(`
	pos *= vec3(0.7, 0.7, 0.7);
	`)

	if (!forMousePicker)
		parts.push(`
	v_currentPosition = pos + worldPosition;
	`)

	parts.push(`
	float rotationProgress = activityDuration / 5.0;
	float a = (rotationProgress > 1.0 || !mergeRotations) ? float(unitRotationAsInt) : mix(float(unitPreviousRotation + 8 * ((unitRotationAsInt - unitPreviousRotation) / 4)), float(unitRotationAsInt), rotationProgress);
	
    a *= PI / 4.0;
    mat4 rotation = ${RotationMatrix('a')};
    `)

	if (!forMousePicker)
		parts.push(`
	v_normal = (rotation * vec4(v_normal, 1.0)).xyz;
	`)

	parts.push(`
	vec4 posRotated = rotation * vec4(pos, 1);
	posRotated += vec4(0.5, 1.1, 0.5, 0.0) + vec4(worldPosition, 0.0);
    gl_PointSize = 10.0;
    `)

	parts.push(`gl_Position = u_combinedMatrix * posRotated;`)

	if (forMousePicker) parts.push(`
	uint intId = uint(a_unitId);
	uint fractionalId = uint((a_unitId - float(intId)) * 256.0);
	v_color0 = vec4((intId >> 8U) & 255U, intId & 255U, fractionalId & 255U, 1.0) / 255.0;
	v_color1 = vec3(0.0, 0.0, ${MousePickableType.Unit}) / 255.0;
	`)

	parts.push(`
}
`)

	return parts.join('\n')
}


export const standardFragmentShaderSource = `${VersionHeader()}
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
}
`


export type Uniforms = 'time' | 'gameTime' | 'gameTick' | 'combinedMatrix' | 'lightPosition'
export type Attributes =
	'modelPosition'
	| 'worldPosition'
	| 'flags'
	| 'unitId'
	| 'colorPaletteId'
	| 'activityStartTick'
	| 'unitRotation'

export const enum ShaderId {
	Stationary,
	Idle,
	Walking,
	PickUpItem,
}

export interface UnitShaderCreationOptions {
	readonly forMousePicker: boolean
	readonly holdingItem: boolean
}

export const shaderTransformationSources = (): readonly ((options: UnitShaderCreationOptions) => string)[] => [
	() => ``,
	idleVertexTransformationsSource,
	walkingVertexTransformationsSource,
	itemPickUpTransformationsSource,
]
