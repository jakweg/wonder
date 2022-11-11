import TypedArray from '@seampan/typed-array'
import { mergeModels, ModelPart, transformPointsByMatrix } from './model'
import { ModelAttributeType } from './model-attribute-type'
import {
  DynamicTransform,
  matrixFromStaticTransform,
  shaderCodeFromDynamicTransform,
  StaticTransform,
} from './transform'

type ModelAttributes = { [key: string]: ModelAttributeType }
export type ModelDescription<T extends TypedArray, A extends ModelAttributes> = (
  | {
      mesh: ModelPart<T, A>
      children?: undefined
    }
  | {
      mesh?: undefined
      children: ModelDescription<T, A>[]
    }
) & {
  staticTransform: ReadonlyArray<StaticTransform>
} & (
    | {
        dynamicTransformCondition: string
        dynamicTransform: ReadonlyArray<DynamicTransform>
      }
    | {
        dynamicTransformCondition?: undefined
        dynamicTransform?: undefined
      }
  )

export type DefinedModel<T, A extends ModelAttributes> = {
  vertexPoints: Float32Array
  indices: Uint16Array
  vertexDataArray: T
  modelTransformationShader: string
  modelAttributes: A
}

export type DefinedModelWithAttributes<T, A extends ModelAttributes> = DefinedModel<T, A> & {
  copyBytesPerInstanceCount: number
  entityAttributes: ModelAttributes
}

export const defineModel = <T extends TypedArray, A extends ModelAttributes>(
  description: ModelDescription<T, A>,
): DefinedModel<T, A> => {
  if (description.mesh) {
    const model = description.mesh

    const staticTransform = matrixFromStaticTransform(description.staticTransform)
    transformPointsByMatrix(model.vertexPoints, staticTransform)

    const shader =
      description.dynamicTransformCondition !== undefined && description.dynamicTransform !== undefined
        ? shaderCodeFromDynamicTransform(description.dynamicTransformCondition, description.dynamicTransform, [])
        : ''

    return {
      vertexPoints: model.vertexPoints,
      indices: model.indices,
      vertexDataArray: model.vertexDataArray,
      modelTransformationShader: shader,
      modelAttributes: model.modelAttributes,
    }
  } else if (description.children && description.children.length > 0) {
    const children = description.children
    const defined = children.map(e => defineModel(e))

    const merged = mergeModels(defined)

    const needsConvertStaticToDynamic = description.children['some'](
      c => c.dynamicTransform !== undefined && c.dynamicTransform.length > 0,
    )

    const staticTransform = matrixFromStaticTransform(description.staticTransform)
    if (!needsConvertStaticToDynamic) transformPointsByMatrix(merged.vertexPoints, staticTransform)

    const shader = shaderCodeFromDynamicTransform(
      description.dynamicTransformCondition ?? 'true',
      description.dynamicTransform ?? [],
      [
        ...defined.map(e => e.modelTransformationShader),
        shaderCodeFromDynamicTransform('true', needsConvertStaticToDynamic ? description.staticTransform : [], []),
      ],
    )

    return {
      vertexPoints: merged.vertexPoints,
      indices: merged.indices,
      vertexDataArray: merged.vertexDataArray,
      modelAttributes: merged.modelAttributes,
      modelTransformationShader: shader,
    }
  } else throw new Error()
}
