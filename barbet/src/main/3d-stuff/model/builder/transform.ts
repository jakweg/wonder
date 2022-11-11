import { RotationXMatrix, RotationYMatrix, RotationZMatrix } from '@3d/common-shader'
import * as mat4 from '@matrix/mat4'

export const enum TransformType {
  Scale,
  Translate,
  RotateX,
  RotateY,
  RotateZ,
}

export type StaticTransform =
  | never
  | { type: TransformType.Translate; by: [number, number, number] }
  | { type: TransformType.Scale; by: [number, number, number] | number }
  | { type: TransformType.RotateX; by: number }
  | { type: TransformType.RotateY; by: number }
  | { type: TransformType.RotateZ; by: number }

type DynamicTransformResolvable = null | string | number

export type DynamicTransform = (
  | {
      type: TransformType.Translate
      by: [DynamicTransformResolvable, DynamicTransformResolvable, DynamicTransformResolvable]
    }
  | {
      type: TransformType.Scale
      by:
        | [DynamicTransformResolvable, DynamicTransformResolvable, DynamicTransformResolvable]
        | DynamicTransformResolvable
    }
  | {
      type: TransformType.RotateY | TransformType.RotateX | TransformType.RotateZ
      by: DynamicTransformResolvable
      normalToo?: true
    }
) & { beforeBlock?: string; afterBlock?: string }

export const matrixFromStaticTransform = (operations: ReadonlyArray<StaticTransform>) => {
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

export const shaderCodeFromDynamicTransform = (
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
