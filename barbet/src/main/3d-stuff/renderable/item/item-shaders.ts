import {
	PIConstantHeader,
	PrecisionHeader,
	RotationMatrix,
	RotationVectorsDeclaration,
	VersionHeader,
} from '../../shader/common'

export const enum UnitData {
	MaskRotation = 0b111 << 0,
	MaskMoving = 0b1 << 3,
	Moving = 1 << 3,
	Default = 0b0_000,
}

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
${PIConstantHeader()}
${RotationVectorsDeclaration()}
in vec3 a_modelPosition;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition;
uniform vec3 u_unitPosition;
uniform float u_activityStartTick;
uniform int u_unitData;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
uniform float u_gameTick;

void main() {
	int flagsAsInt = int(a_flags);
	v_normal = vec3(ivec3(((flagsAsInt >> 4) & 3) - 1, ((flagsAsInt >> 2) & 3) - 1, (flagsAsInt & 3) - 1));
	bool moving = (u_unitData & ${UnitData.MaskMoving}) == ${UnitData.Moving};
	int rotationIndex = u_unitData & ${UnitData.MaskRotation};
    float a = float(rotationIndex) * PI / 4.0;
    mat4 rotation = ${RotationMatrix('a')};
	
	v_color = vec3(1,0,0);
	vec3 pos = a_modelPosition;
	pos *= vec3(0.6);
	float activityDuration = u_gameTick - u_activityStartTick;
	
	pos = (rotation * vec4(vec3(0.6, 0.75, 0.0) + pos, 1.0)).xyz + vec3(0.5, 0, 0.5);
	pos += u_unitPosition + (moving ? (rotationVectors[rotationIndex] * activityDuration / 15.0) : vec3(0,0,0));
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
	| 'unitData'
export type Attributes = 'worldPosition' | 'modelPosition' | 'flags'
