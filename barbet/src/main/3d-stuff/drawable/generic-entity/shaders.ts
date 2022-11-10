import { getGlslNameByType, ModelAttributeType } from '@3d/model/builder/model-attribute-type'
import {
  GlobalUniformBlockDeclaration,
  PrecisionHeader,
  TerrainHeightMultiplierDeclaration,
  VersionHeader
} from '../../common-shader'

interface ShaderOptions {
  modelTransformationsSource: string
  attributes: { [key: string]: ModelAttributeType }
}

export const vertexShaderSource = (options: ShaderOptions): string => {
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), TerrainHeightMultiplierDeclaration(), GlobalUniformBlockDeclaration())

  for (const [name, type] of Object.entries(options.attributes)) {
    let typeName = getGlslNameByType(type)
    parts.push(`in `, typeName, ` a_entity`, name, `;\n`)
  }

  parts.push(`

in vec3 a_modelPosition;
in uint a_modelNormal;
in vec3 a_modelSideColor;
in uint a_modelFlags;

flat out vec3 v_color;

void main() {
  uint a_entityId = 1U;
  // uint a_entitySize = 2U;
	vec3 normal = vec3(uvec3((a_modelNormal >> 4U) & 3U, (a_modelNormal >> 2U) & 3U, (a_modelNormal >> 0U) & 3U)) - vec3(1.0, 1.0, 1.0);

	uint modelPart = a_modelFlags >> 4U;
	vec3 faceColor = modelPart > 0U ? a_modelSideColor : a_entityColor;
	// vec3 faceColor = modelPart > 0U ? a_modelSideColor : vec3(0,0,0);
	vec3 model = a_modelPosition;
	${options.modelTransformationsSource}
	float light = clamp(dot(normalize(normal), u_light.xyz), u_light.w, 1.0);
	v_color = mix(faceColor, faceColor * light, 0.8);

	gl_Position = u_combinedMatrix * vec4(model, 1.0);
	gl_PointSize = 10.0;
}
	`)

  return parts.join('')
}

export const fragmentShaderSource = (options: ShaderOptions) => {
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader())
  parts.push(`
out vec3 finalColor;
flat in vec3 v_color;

void main() {
	finalColor = v_color;
}
`)

  return parts.join('')
}

export type Uniforms = never
export type Attributes =
  | 'modelPosition'
  | 'modelSideColor'
  | 'modelFlags'
  | 'modelNormal'
  | 'entityPosition'
  | 'entityId'
  | 'entityColor'
  | 'entitySize'
  | 'entityRotation'
  | 'entityRotationChangeTick'
