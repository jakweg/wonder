import { walkingDurationByDirection } from '../game-state/activities/walking'
import { GlProgram, MainRenderer } from '../main-renderer'

export const VersionHeader = () => `#version 300 es`

export const PrecisionHeader = () => `precision mediump float;`

export const PIConstantHeader = () => `const float PI = 3.141592653589;`

export const RotationVectorsDeclaration = () => `const vec3 rotationVectors[8] = vec3[8](vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, -1.0), vec3(0.0, 0.0, -1.0), vec3(-1.0, 0.0, -1.0), vec3(-1.0, 0.0, 0.0), vec3(-1.0, 0.0, 1.0), vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 1.0));`

export const WalkingDurationsByRotation = () => `const float walkingDurations[8] = float[8](${walkingDurationByDirection.map(e => e.toFixed(8)).join(',')});`

export const RotationMatrix = (angleVariableName: string) => `mat4(cos(${angleVariableName}), 0, -sin(${angleVariableName}), 0, 0, 1, 0, 0, sin(${angleVariableName}), 0, cos(${angleVariableName}), 0, 0, 0, 0, 1)`

export const createProgramFromNewShaders = <A, U>(renderer: MainRenderer,
                                                  vertexSource: string,
                                                  fragmentSource: string)
// @ts-ignore
	: GlProgram<A, U> => {
	const vert = renderer.createShader(true, vertexSource)
	const frag = renderer.createShader(false, fragmentSource)
	return renderer.createProgram<A, U>(vert, frag)
}


export const freezeAndValidateOptionsList = <T>(list: T[],
                                                indexGetter: (value: T) => number = (value) => (value as any)['numericId']!) => {
	Object.freeze(list)
	for (let i = 0, s = list.length; i < s; i++) {
		const item = list[i]!
		Object.freeze(item)
		const index = indexGetter(item)
		if (i !== index)
			throw new Error(`Object has invalid index property: expected ${i}, but got ${index}, object: ${JSON.stringify(item)}`)
	}
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
