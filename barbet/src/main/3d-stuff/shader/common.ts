import { GlProgram, MainRenderer } from '../main-renderer'

export const VersionHeader = () => `#version 300 es`

export const PrecisionHeader = () => `precision mediump float;`

export const PIConstantHeader = () => `const float PI = 3.141592653589;`

export const RotationMatrix = (angleVariableName: string) => `mat4(cos(${angleVariableName}), 0, -sin(${angleVariableName}), 0, 0, 1, 0, 0, sin(${angleVariableName}), 0, cos(${angleVariableName}), 0, 0, 0, 0, 1)`

export const createProgramFromNewShaders = <A, U>(renderer: MainRenderer,
                                                  vertexSource: string,
                                                  fragmentSource: string): GlProgram<A, U> => {
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
