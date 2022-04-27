import { idleVertexTransformationsSource } from '../../../game-state/activities/idle'
import { itemPickUpTransformationsSource } from '../../../game-state/activities/item-pickup'
import { walkingVertexTransformationsSource } from '../../../game-state/activities/walking'
import { Direction } from '../../../util/direction'
import { miningResourceTransformationsSource } from '../../additional-renderables/hammer'
import {
	PIConstantHeader,
	PrecisionHeader,
	RotationVectorsDeclaration,
	RotationYMatrix, TerrainHeightMultiplierDeclaration,
	VersionHeader,
	WalkingDurationsByRotation,
} from '../../common-shader'
import { MousePickableType } from '../../mouse-picker'
import { buildShaderColorArray } from './unit-color'

export const enum UnitBodyPart {
	MASK_PROVOKING = 0b1 << 6,
	FLAG_PROVOKING_BOTTOM = 0b0 << 6,
	FLAG_PROVOKING_TOP = 0b1 << 6,

	MASK_POSITION = 0b11 << 7,
	FLAG_POSITION_BOTTOM = 0b00 << 7,
	FLAG_POSITION_MIDDLE = 0b01 << 7,
	FLAG_POSITION_TOP = 0b10 << 7,

	MASK_BODY_PART = 0b1111 << 9,
	FLAG_PART_MAIN_BODY = 0b0001 << 9,
	FLAG_PART_FACE = 0b1001 << 9,
	MASK_PART_ANY_ARM = 0b0010 << 9,
	MASK_PART_ANY_LEG = 0b0100 << 9,
	FLAG_PART_LEFT = 0b0000 << 9,
	FLAG_PART_RIGHT = 0b0001 << 9,
	FLAG_PART_LEFT_ARM = MASK_PART_ANY_ARM | FLAG_PART_LEFT,
	FLAG_PART_RIGHT_ARM = MASK_PART_ANY_ARM | FLAG_PART_RIGHT,
	FLAG_PART_LEFT_LEG = MASK_PART_ANY_LEG | FLAG_PART_LEFT,
	FLAG_PART_RIGHT_LEG = MASK_PART_ANY_LEG | FLAG_PART_RIGHT
}

export const constructUnitVertexShaderSource = (transformations: string,
                                                {forMousePicker}: UnitShaderCreationOptions): string => {
	const parts: string[] = [VersionHeader(),
		PrecisionHeader(),
		PIConstantHeader(),
		RotationVectorsDeclaration(),
		WalkingDurationsByRotation(),
		TerrainHeightMultiplierDeclaration(),
	]

	parts.push(`
in vec3 a_modelPosition;
in vec3 a_worldPosition;
in float a_unitRotation;
in float a_flags;
in float a_activityStartTick;
in float a_unitId; // or a_colorPaletteId
uniform vec3 u_times; // time, gameTime, gameTick
`)
	if (forMousePicker) parts.push(`
uniform mat4 u_combinedMatrix;
flat out vec4 v_color0;
flat out vec3 v_color1;
`)
	else parts.push(`
uniform mat4 u_combinedMatrix;
flat out vec3 v_currentPosition;
flat out int v_colorPaletteId;
flat out vec3 v_normal;
`)


	parts.push(`
void main() {
	vec3 worldPosition = a_worldPosition;
	worldPosition.y *= terrainHeightMultiplier;
	int flagsAsInt = int(a_flags) + int(a_unitId * 0.0);
`)
	if (!forMousePicker)
		parts.push(`
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	if ((flagsAsInt & ${UnitBodyPart.MASK_BODY_PART}) == ${UnitBodyPart.FLAG_PART_FACE}) {
		v_colorPaletteId = int(int(a_unitId) * 9 + 6);
	} else {
		bool isProvokingTop = (flagsAsInt & ${UnitBodyPart.MASK_PROVOKING}) == ${UnitBodyPart.FLAG_PROVOKING_TOP};
		v_colorPaletteId = int((isProvokingTop ? (int(a_unitId) * 9 + 3) : int(a_unitId) * 9));
	}
	`)

	parts.push(`
	int tmpIRotation = int(a_unitRotation);
	int unitRotationAsInt = tmpIRotation & ${Direction.MaskCurrentRotation};
	bool mergeRotations = ((tmpIRotation & ${Direction.MaskMergePrevious}) == ${Direction.FlagMergeWithPrevious});
	int unitPreviousRotation = (mergeRotations ? ((tmpIRotation & ${Direction.MaskPreviousRotation}) >> 3) : (unitRotationAsInt));
	
	vec3 pos = a_modelPosition;
	bool isMainBodyVertex = (flagsAsInt & ${UnitBodyPart.MASK_BODY_PART}) == ${UnitBodyPart.FLAG_PART_MAIN_BODY};
	bool isFaceVertex = (flagsAsInt & ${UnitBodyPart.MASK_BODY_PART}) == ${UnitBodyPart.FLAG_PART_FACE};
	bool isTopVertex = (flagsAsInt & ${UnitBodyPart.MASK_POSITION}) == ${UnitBodyPart.FLAG_POSITION_TOP};
	bool isMiddleVertex = (flagsAsInt & ${UnitBodyPart.MASK_POSITION}) == ${UnitBodyPart.FLAG_POSITION_MIDDLE};
	bool isBottomVertex = (flagsAsInt & ${UnitBodyPart.MASK_POSITION}) == ${UnitBodyPart.FLAG_POSITION_BOTTOM};
	bool isAnimatableElement = (flagsAsInt & ${UnitBodyPart.MASK_PART_ANY_LEG | UnitBodyPart.MASK_PART_ANY_ARM}) > 0;
	bool isLeftArmVertex = (flagsAsInt & ${UnitBodyPart.MASK_BODY_PART}) == ${UnitBodyPart.FLAG_PART_LEFT_ARM};
	bool isRightArmVertex = (flagsAsInt & ${UnitBodyPart.MASK_BODY_PART}) == ${UnitBodyPart.FLAG_PART_RIGHT_ARM};
	bool isLeftLegVertex = (flagsAsInt & ${UnitBodyPart.MASK_BODY_PART}) == ${UnitBodyPart.FLAG_PART_LEFT_LEG};
	bool isRightLegVertex = (flagsAsInt & ${UnitBodyPart.MASK_BODY_PART}) == ${UnitBodyPart.FLAG_PART_RIGHT_LEG};
	float activityDuration = u_times.z - a_activityStartTick;
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
    mat4 rotation = ${RotationYMatrix('a')};
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


export const standardFragmentShaderSource = () => `${VersionHeader()}
${PrecisionHeader()}
out vec3 finalColor;
flat in int v_colorPaletteId;
flat in vec3 v_normal;
flat in vec3 v_currentPosition;
uniform vec3 u_lightPosition;
const float ambientLight = 0.4;
${buildShaderColorArray('unitColors')}
void main() {
	vec3 lightDirection = normalize(vec3(u_lightPosition) - v_currentPosition);
	float diffuse =  clamp(sqrt(dot(v_normal, lightDirection)), ambientLight, 1.0);
	vec3 color = vec3(unitColors[v_colorPaletteId], unitColors[v_colorPaletteId + 1], unitColors[v_colorPaletteId + 2]);
	finalColor = color * diffuse;
}
`


export type Uniforms = 'times' | 'combinedMatrix' | 'lightPosition'
export type Attributes =
	'modelPosition'
	| 'worldPosition'
	| 'flags'
	| 'unitId'
	| 'activityStartTick'
	| 'unitRotation'

export const enum ShaderId {
	Stationary,
	Idle,
	Walking,
	PickUpItem,
	MiningResource,
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
	miningResourceTransformationsSource,
]
