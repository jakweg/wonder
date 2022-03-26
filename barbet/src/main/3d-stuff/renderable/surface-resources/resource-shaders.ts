import { PrecisionHeader, VersionHeader } from '../../shader/common'

export const surfaceResourceVertexShader = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_modelPosition;
in vec3 a_normal;
flat out vec3 v_color;
flat out vec3 v_normal; 
flat out vec3 v_currentPosition;
uniform mat4 u_combinedMatrix;
void main() {
	v_normal = a_normal;
	
	v_color = vec3(1,0,1);
	vec3 pos = a_modelPosition;
    v_currentPosition = pos;
    gl_Position = u_combinedMatrix * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`

export const surfaceResourceFragmentShader = `${VersionHeader()}
${PrecisionHeader()}
out vec3 finalColor;
flat in vec3 v_color;
flat in vec3 v_normal;
flat in vec3 v_currentPosition;
uniform vec3 u_lightPosition;
const float ambientLight = 0.3;
void main() {
	vec3 lightDirection = normalize(vec3(u_lightPosition) - v_currentPosition);
	float diffuse = max(sqrt(dot(v_normal, lightDirection)), ambientLight);
	finalColor = vec3(v_color * diffuse);
}
`

export type Uniforms = 'combinedMatrix' | 'lightPosition'
export type Attributes = 'modelPosition' | 'normal'
