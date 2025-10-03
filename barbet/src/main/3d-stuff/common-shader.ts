export const VersionHeader = () => `#version 300 es\n`

export const PrecisionHeader = () => `precision highp float;\nprecision highp usampler2D;\n`

export const PIConstantHeader = () => `const float PI = ${Math.PI};\nconst float PI_OVER1 = ${1 / Math.PI};`

export const RotationVectorsDeclaration = () =>
  `const vec3 rotationVectors[8] = vec3[8](vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, -1.0), vec3(0.0, 0.0, -1.0), vec3(-1.0, 0.0, -1.0), vec3(-1.0, 0.0, 0.0), vec3(-1.0, 0.0, 1.0), vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 1.0));`

export const RotationYMatrix = (angleVariableName: string) =>
  `mat3(cos(${angleVariableName}), 0, -sin(${angleVariableName}), 0, 1, 0, sin(${angleVariableName}), 0, cos(${angleVariableName}))`

export const RotationXMatrix = (angleVariableName: string) =>
  `mat3(1, 0, 0, 0, cos(${angleVariableName}), sin(${angleVariableName}), 0, -sin(${angleVariableName}), cos(${angleVariableName}))`

export const RotationZMatrix = (angleVariableName: string) =>
  `mat3(cos(${angleVariableName}), sin(${angleVariableName}), 0, -sin(${angleVariableName}), cos(${angleVariableName}), 0, 0, 0, 1)`

export const TerrainHeightMultiplierUniform = 'u_terrainHeight'
export const WorldSizeInChunksUniform = 'u_worldLevel'
export const GlobalUniformBlockDeclaration = () => `
layout(std140) uniform Globals {
	mat4 u_combinedMatrix;
	vec3 u_gameTimes;
  float ${TerrainHeightMultiplierUniform};
	vec4 u_light;
  highp uint ${WorldSizeInChunksUniform};
};\n`
export const RenderTimeUniform = 'u_gameTimes.x'
export const GameTimeUniform = 'u_gameTimes.y'
export const GameTickUniform = 'u_gameTimes.z'

export const pickViaMouseDefaultFragmentShader = () => `${VersionHeader()}
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

export function calculateNormals(
  elements: Uint16Array | Uint8Array,
  vertexes: Float32Array,
  vertexSize: number,
  normalsOffset: number,
): void {
  for (let i = 0, l = elements.length; i < l; ) {
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
