import * as vec4 from '@matrix/vec4';

const sharedTemporaryVector: [number, number, number, number] = [0, 0, 0, 0]
export type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;

export interface Model<VertexData extends TypedArray> {
    readonly vertexPoints: Float32Array
    readonly indices: Uint16Array
    readonly vertexDataArray: VertexData
}

const getConstructor = <T extends TypedArray>(array: T): (new (length: number) => T) => {
    if (array instanceof Float32Array) return Float32Array as any
    if (array instanceof Int32Array) return Int32Array as any
    throw new Error()
}

export const mergeModels = <T extends TypedArray>(models: Model<T>[]): Model<T> => {
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
    const mergedDataValues = new (constructor)(totalData)

    let indicesIndex = 0
    let pointsIndex = 0
    let dataIndex = 0

    for (const o of models) {
        for (const index of o.indices)
            mergedIndices[indicesIndex++] = index + indicesSum

        indicesSum += o.vertexPoints.length / 3

        for (const value of o.vertexPoints)
            mergedPoints[pointsIndex++] = value

        for (const value of o.vertexDataArray)
            mergedDataValues[dataIndex++] = value
    }

    return {
        vertexPoints: mergedPoints,
        indices: mergedIndices,
        vertexDataArray: mergedDataValues,
    }
}

export const transformPointsByMatrix = (points: Float32Array, matrix: any): void => {
    const tmpVector = sharedTemporaryVector
    for (let i = 0, l = points.length; i < l; i += 3) {
        tmpVector[0] = points[i + 0]!
        tmpVector[1] = points[i + 1]!
        tmpVector[2] = points[i + 2]!
        vec4.transformMat4(tmpVector, tmpVector, matrix)
        points[i + 0] = tmpVector[0]!
        points[i + 1] = tmpVector[1]!
        points[i + 2] = tmpVector[2]!
    }
}
