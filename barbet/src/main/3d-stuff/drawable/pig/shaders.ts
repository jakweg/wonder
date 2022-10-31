import { PrecisionHeader, TerrainHeightMultiplierDeclaration, VersionHeader } from '../../common-shader';

interface ShaderOptions {
	modelTransformationsSource: string
}

export const vertexShaderSource = (options: ShaderOptions): string => {
	const parts: string[] = [];
	parts.push(`${VersionHeader()}
	${PrecisionHeader()}
	${TerrainHeightMultiplierDeclaration()}
	`)

	parts.push(`
uniform mat4 u_combinedMatrix;
uniform float u_time;
in vec3 a_modelPosition;
void main() {
	vec3 model = a_modelPosition;
	${options.modelTransformationsSource}

	gl_Position = u_combinedMatrix * vec4(model + vec3(5.0, 2.1, 5.0), 1.0);
	gl_PointSize = 10.0;
}
	`)

	return parts.join('')
}


export const fragmentShaderSource = (options: ShaderOptions) => {
	const parts: string[] = [];
	parts.push(`${VersionHeader()}
${PrecisionHeader()}
out vec3 finalColor;

void main() {
	finalColor = vec3(1.0, 0.0, 0.0);
}
`)

	return parts.join('')
}

export type Uniforms = 'combinedMatrix' | 'time'
export type Attributes = 'modelPosition'
