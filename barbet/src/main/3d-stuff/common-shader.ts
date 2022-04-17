import { walkingDurationByDirection } from '../game-state/activities/walking'
import { GlProgram, MainRenderer } from './main-renderer'

export const VersionHeader = () => `#version 300 es`

export const PrecisionHeader = () => `precision highp float;`

export const PIConstantHeader = () => `const float PI = ${Math.PI};\nconst float PI_OVER1 = ${1 / Math.PI};`

export const RotationVectorsDeclaration = () => `const vec3 rotationVectors[8] = vec3[8](vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, -1.0), vec3(0.0, 0.0, -1.0), vec3(-1.0, 0.0, -1.0), vec3(-1.0, 0.0, 0.0), vec3(-1.0, 0.0, 1.0), vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 1.0));`

export const WalkingDurationsByRotation = () => `const float walkingDurations[8] = float[8](${walkingDurationByDirection.map(e => e.toFixed(8)).join(',')});`

export const RotationYMatrix = (angleVariableName: string) => `mat4(cos(${angleVariableName}), 0, -sin(${angleVariableName}), 0, 0, 1, 0, 0, sin(${angleVariableName}), 0, cos(${angleVariableName}), 0, 0, 0, 0, 1)`

export const RotationXMatrix = (angleVariableName: string) => `mat4(1, 0, 0, 0, 0, cos(${angleVariableName}), sin(${angleVariableName}), 0, 0, -sin(${angleVariableName}), cos(${angleVariableName}), 0, 0, 0, 0, 1)`

export const RotationZMatrix = (angleVariableName: string) => `mat4(cos(${angleVariableName}), sin(${angleVariableName}), 0, 0, -sin(${angleVariableName}), cos(${angleVariableName}), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)`

export const createProgramFromNewShaders = <A, U>(renderer: MainRenderer,
                                                  vertexSource: string,
                                                  fragmentSource: string)
// @ts-ignore
	: GlProgram<A, U> => {
	const vert = renderer.createShader(true, vertexSource)
	const frag = renderer.createShader(false, fragmentSource)
	return renderer.createProgram<A, U>(vert, frag)
}


export const pickViaMouseDefaultFragmentShader = `${VersionHeader()}
${PrecisionHeader()}
layout(location = 0) out vec4 finalColor0;
layout(location = 1) out vec3 finalColor1;
flat in vec4 v_color0;
flat in vec3 v_color1;
void main() {
	finalColor0 = v_color0;
	finalColor1 = v_color1;
}
`

export function calculateNormals(elements: Uint16Array | Uint8Array,
                                 vertexes: Float32Array,
                                 vertexSize: number,
                                 normalsOffset: number): void {
	for (let i = 0, l = elements.length; i < l;) {
		const a = elements[i++]!
		const b = elements[i++]!
		const c = elements[i++]!


		const aIndex = a * vertexSize
		const ax = vertexes[aIndex]!
		const ay = vertexes[aIndex + 1]!
		const az = vertexes[aIndex + 2]!

		const bIndex = b * vertexSize
		const bx = vertexes[bIndex]!
		const by = vertexes[bIndex + 1]!
		const bz = vertexes[bIndex + 2]!

		const cIndex = c * vertexSize

		const nx = ay * bz - az * by
		const ny = az * bx - ax * bz
		const nz = ax * by - ay * bx


		vertexes[cIndex + normalsOffset] = -Math.min(1, Math.max(-1, nx))
		vertexes[cIndex + normalsOffset + 1] = Math.min(1, Math.max(-1, ny))
		vertexes[cIndex + normalsOffset + 2] = -Math.min(1, Math.max(-1, nz))
	}
}
