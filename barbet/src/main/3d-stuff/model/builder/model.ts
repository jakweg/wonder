import * as vec4 from '@matrix/vec4'
import TypedArray, { TypedArrayConstructor } from '@seampan/typed-array'
import { ModelAttributeType } from './model-attribute-type'

const sharedTemporaryVector: [number, number, number, number] = [0, 0, 0, 0]

type ModelAttributes = { [key: string]: ModelAttributeType }

export interface ModelPart<VertexData extends TypedArray, A extends ModelAttributes> {
  readonly vertexPoints: Float32Array
  readonly indices: Uint16Array
  readonly vertexDataArray: VertexData
  readonly modelAttributes: A
}

const getConstructor = <T extends TypedArray>(array: T): TypedArrayConstructor<T> => {
  if (array instanceof Float32Array) return Float32Array as any
  if (array instanceof Int32Array) return Int32Array as any
  if (array instanceof Uint8Array) return Uint8Array as any
  throw new Error()
}

export const mergeModels = <T extends TypedArray, A extends ModelAttributes>(
  models: ModelPart<T, A>[],
): ModelPart<T, A> => {
  if (models.length === 0) throw new Error()

  let totalIndices = 0
  let totalPoints = 0
  let totalData = 0

  for (const o of models) {
    totalIndices += o.indices.length
    totalPoints += o.vertexPoints.length
    totalData += o.vertexDataArray.length
  }

  let indicesSum = 0
  const mergedIndices = new Uint16Array(totalIndices)
  const mergedPoints = new Float32Array(totalPoints)
  const constructor = getConstructor(models[0]!.vertexDataArray)
  const mergedDataValues = new constructor(totalData)

  let indicesIndex = 0
  let pointsIndex = 0
  let dataIndex = 0

  for (const o of models) {
    for (const index of o.indices) mergedIndices[indicesIndex++] = index + indicesSum

    indicesSum += o.vertexPoints.length / 3

    for (const value of o.vertexPoints) mergedPoints[pointsIndex++] = value

    for (const value of o.vertexDataArray) mergedDataValues[dataIndex++] = value
  }

  return {
    vertexPoints: mergedPoints,
    indices: mergedIndices,
    vertexDataArray: mergedDataValues,
    modelAttributes: models[0]!.modelAttributes,
  }
}

export const transformPointsByMatrix = (points: Float32Array, matrix: any): void => {
  const tmpVector = sharedTemporaryVector
  for (let i = 0, l = points.length; i < l; i += 3) {
    tmpVector[0] = points[i + 0]!
    tmpVector[1] = points[i + 1]!
    tmpVector[2] = points[i + 2]!
    tmpVector[3] = 1.0
    vec4.transformMat4(tmpVector, tmpVector, matrix)
    const w = tmpVector[3]
    points[i + 0] = tmpVector[0]! / w
    points[i + 1] = tmpVector[1]! / w
    points[i + 2] = tmpVector[2]! / w
  }
}
