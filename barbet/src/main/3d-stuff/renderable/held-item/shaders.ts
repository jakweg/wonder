import { Direction } from '../../../util/direction'
import {
	PIConstantHeader,
	PrecisionHeader,
	RotationVectorsDeclaration,
	RotationYMatrix,
	VersionHeader,
	WalkingDurationsByRotation,
} from '../../common-shader'

export const enum UnitData {
	MaskRotation = 0b1111111 << 0,
	MaskMoving = 0b1 << 7,
	Moving = 1 << 7,
	Default = 0,
}

export const inHandVertexShader = `${VersionHeader()}
${PrecisionHeader()}
${PIConstantHeader()}
${RotationVectorsDeclaration()}
${WalkingDurationsByRotation()}
in vec3 a_modelPosition;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition;
uniform vec3 u_unitPosition;
uniform float u_activityStartTick;
uniform int u_unitData;
uniform mat4 u_combinedMatrix;
uniform float u_gameTick;

void main() {
	int flagsAsInt = int(a_flags);
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	bool moving = (u_unitData & ${UnitData.MaskMoving}) == ${UnitData.Moving};
	int tmpIRotation = int(u_unitData & ${UnitData.MaskRotation});
	int unitRotationAsInt = tmpIRotation & ${Direction.MaskCurrentRotation};
	bool mergeRotations = ((tmpIRotation & ${Direction.MaskMergePrevious}) == ${Direction.FlagMergeWithPrevious});
	int unitPreviousRotation = (mergeRotations ? ((tmpIRotation & ${Direction.MaskPreviousRotation}) >> 3) : (unitRotationAsInt));

	float activityDuration = u_gameTick - u_activityStartTick;
    
	float rotationProgress = activityDuration / 5.0;
	float a = (rotationProgress > 1.0 || !mergeRotations) ? float(unitRotationAsInt) : mix(float(unitPreviousRotation + 8 * ((unitRotationAsInt - unitPreviousRotation) / 4)), float(unitRotationAsInt), rotationProgress);
	
    a *= PI / 4.0;
    mat4 rotation = ${RotationYMatrix('a')};
	
	v_color = vec3(1,0,0);
	vec3 pos = a_modelPosition;
	pos *= vec3(0.6);
	
	pos = (rotation * vec4(vec3(0.6, 0.75, 0.0) + pos, 1.0)).xyz + vec3(0.5, 0, 0.5);
	pos += u_unitPosition + (moving ? (rotationVectors[unitRotationAsInt] * (activityDuration / walkingDurations[unitRotationAsInt]) - rotationVectors[unitRotationAsInt]) : vec3(0,0,0));
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
