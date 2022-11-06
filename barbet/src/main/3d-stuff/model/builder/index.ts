import * as mat4 from '@matrix/mat4'
import TypedArray from '@seampan/typed-array'
import { RotationXMatrix, RotationYMatrix, RotationZMatrix } from '../../common-shader'
import { mergeModels, Model, transformPointsByMatrix } from './model'
import { DynamicTransform, StaticTransform, TransformType } from './transform'

export type ModelDefinition<T extends TypedArray> = (
  | {
      mesh: Model<T>
      children?: undefined
    }
  | {
      mesh?: undefined
      children: ModelDefinition<T>[]
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

const matrixFromStaticTransform = (operations: ReadonlyArray<StaticTransform>) => {
  const matrix = mat4.create()
  for (const operation of operations) {
    switch (operation.type) {
      case TransformType.Translate:
        mat4.translate(matrix, matrix, operation.by)
        break
      case TransformType.Scale:
        mat4.scale(
          matrix,
          matrix,
          typeof operation.by === 'number' ? [operation.by, operation.by, operation.by] : operation.by,
        )
        break
      case TransformType.RotateX:
        mat4.rotateX(matrix, matrix, operation.by)
        break
      case TransformType.RotateY:
        mat4.rotateY(matrix, matrix, operation.by)
        break
      case TransformType.RotateZ:
        mat4.rotateZ(matrix, matrix, operation.by)
        break
      default:
        throw new Error()
    }
  }
  return matrix
}

const formatNumberOrString = (value: string | number) => {
  return typeof value === 'number' ? value.toFixed(5) : value
}

const shaderCodeFromDynamicTransform = (
  condition: string,
  operations: ReadonlyArray<DynamicTransform>,
  otherShaders: string[],
) => {
  const shaderParts = []

  shaderParts.push(`if (`, condition, `) {\n\n`)
  shaderParts.push(...otherShaders)
  shaderParts.push('\n\n')
  for (const operation of operations) {
    shaderParts.push('{\n')
    if (operation.beforeBlock) shaderParts.push(operation.beforeBlock, '\n')

    switch (operation.type) {
      case TransformType.Scale:
        if (Array.isArray(operation.by)) {
          if (operation.by[0] !== null) shaderParts.push(`model.x *= (`, formatNumberOrString(operation.by[0]), `);\n`)
          if (operation.by[1] !== null) shaderParts.push(`model.y *= (`, formatNumberOrString(operation.by[1]), `);\n`)
          if (operation.by[2] !== null) shaderParts.push(`model.z *= (`, formatNumberOrString(operation.by[2]), `);\n`)
        } else if (operation.by !== null) {
          shaderParts.push(`model *= (`, formatNumberOrString(operation.by), `);\n`)
        }
        break
      case TransformType.Translate:
        if (operation.by[0] !== null && operation.by[0] !== 0)
          shaderParts.push(`model.x += (`, formatNumberOrString(operation.by[0]), `);\n`)
        if (operation.by[1] !== null && operation.by[1] !== 0)
          shaderParts.push(`model.y += (`, formatNumberOrString(operation.by[1]), `);\n`)
        if (operation.by[2] !== null && operation.by[2] !== 0)
          shaderParts.push(`model.z += (`, formatNumberOrString(operation.by[2]), `);\n`)
        break
      case TransformType.RotateX:
        if (operation.by) {
          shaderParts.push(
            '{\nfloat _angle = ',
            operation.by,
            ';\nmat3 _rotation = ',
            RotationXMatrix('_angle'),
            ';\nmodel = _rotation * model;\n',
          )
          if (operation.normalToo === true) shaderParts.push('normal = _rotation * normal;\n')

          shaderParts.push('}\n')
        }
        break
      case TransformType.RotateY:
        if (operation.by) {
          shaderParts.push(
            '{\nfloat _angle = ',
            operation.by,
            ';\nmat3 _rotation = ',
            RotationYMatrix('_angle'),
            ';\nmodel = _rotation * model;\n',
          )
          if (operation.normalToo === true) shaderParts.push('normal = _rotation * normal;\n')

          shaderParts.push('}\n')
        }
        break
      case TransformType.RotateZ:
        if (operation.by) {
          shaderParts.push(
            '{\nfloat _angle = ',
            operation.by,
            ';\nmat3 _rotation = ',
            RotationZMatrix('_angle'),
            ';\nmodel = _rotation * model;\n',
          )
          if (operation.normalToo === true) shaderParts.push('normal = _rotation * normal;\n')

          shaderParts.push('}\n')
        }
        break
      default:
        throw new Error()
    }
    if (operation.afterBlock) shaderParts.push(operation.afterBlock, '\n')
    shaderParts.push('}\n')
  }
  shaderParts.push('}\n\n')

  return shaderParts.join('')
}

export type DefinedModel<T> = {
  vertexPoints: Float32Array
  indices: Uint16Array
  vertexDataArray: T
  modelTransformationShader: string
}

export const defineModel = <T extends TypedArray>(description: ModelDefinition<T>): DefinedModel<T> => {
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
      modelTransformationShader: shader,
    }
  } else throw new Error()
}
