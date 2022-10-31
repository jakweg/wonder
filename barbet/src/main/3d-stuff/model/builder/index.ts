import * as mat4 from "@matrix/mat4"
import * as vec4 from "@matrix/vec4"
import { DynamicTransform, StaticTransform, TransformType } from "./transform"

interface ModelDefinition {
    staticTransform: ReadonlyArray<StaticTransform>
    dynamicTransform: ReadonlyArray<DynamicTransform>
}

const newCube = () => {
    const points: Array<[number, number, number]> = [
        [-0.5, -0.5, -0.5,],
        [0.5, -0.5, -0.5,],
        [0.5, -0.5, 0.5,],
        [-0.5, -0.5, 0.5,],
        [-0.5, 0.5, -0.5,],
        [0.5, 0.5, -0.5,],
        [0.5, 0.5, 0.5,],
        [-0.5, 0.5, 0.5,],
    ]

    const indices: number[] = [
        // bottom
        1, 2, 0,
        2, 3, 0,
        // front
        0, 4, 1,
        4, 5, 1,
        // right side
        1, 5, 2,
        5, 6, 2,
        // left side
        0, 3, 7,
        4, 0, 7,
        // back
        2, 6, 3,
        6, 7, 3,
        // top
        4, 7, 5,
        7, 6, 5,
    ]
    return { points, indices }
}

const matrixFromStaticTransform = (operations: ReadonlyArray<StaticTransform>) => {
    const matrix = mat4.create()
    for (const operation of operations) {
        switch (operation.type) {
            case TransformType.Translate:
                mat4.translate(matrix, matrix, operation.by)
                break
            case TransformType.Scale:
                mat4.scale(matrix, matrix, operation.by)
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
            default: throw new Error()
        }
    }
    return matrix
}

const transformPoints = (points: ReadonlyArray<[number, number, number]>, matrix: any) => {
    const tmpVector: [number, number, number, number] = [0, 0, 0, 0]
    const transformed: Array<[number, number, number]> = points.map(([x, y, z]) => {
        tmpVector[0] = x
        tmpVector[1] = y
        tmpVector[2] = z
        tmpVector[3] = 1
        vec4.transformMat4(tmpVector, tmpVector, matrix)
        return [tmpVector[0], tmpVector[1], tmpVector[2]]
    })
    return transformed
}

const shaderCodeFromDynamicTransform = (operations: ReadonlyArray<DynamicTransform>) => {
    const shaderParts = []
    for (const operation of operations) {
        shaderParts.push('{\n')
        if (operation.beforeBlock)
            shaderParts.push(operation.beforeBlock, '\n')

        switch (operation.type) {
            case TransformType.Scale:
                if (operation.by[0]) shaderParts.push(`model.x *= (`, operation.by[0], `);\n`)
                if (operation.by[1]) shaderParts.push(`model.y *= (`, operation.by[1], `);\n`)
                if (operation.by[2]) shaderParts.push(`model.z *= (`, operation.by[2], `);\n`)
                break
            case TransformType.Translate:
                if (operation.by[0]) shaderParts.push(`model.x += (`, operation.by[0], `);\n`)
                if (operation.by[1]) shaderParts.push(`model.y += (`, operation.by[1], `);\n`)
                if (operation.by[2]) shaderParts.push(`model.z += (`, operation.by[2], `);\n`)
                break
            default:
                throw new Error()
        }
        shaderParts.push('}\n')
    }
    return shaderParts.join('')
}

const defineModel = (description: ModelDefinition) => {
    const { points, indices } = newCube()

    const staticTransform = matrixFromStaticTransform(description.staticTransform)
    const transformed = transformPoints(points, staticTransform)

    const shader = shaderCodeFromDynamicTransform(description.dynamicTransform)

    return { points: transformed.flat(), indices, triangles: indices.length, shader }
}

export const foo = () => {

    const defined = defineModel({
        staticTransform: [
            { type: TransformType.Scale, by: [1.0, 0.4, 0.7] }
        ],
        dynamicTransform: [
            { type: TransformType.Scale, by: [null, `sin(u_time)`, null] },
            {
                beforeBlock: `float sin_value = sin(u_time * 2.0);`,
                type: TransformType.Translate, by: [`sin_value`, null, `sin_value * 0.3`],
            },
        ]
    })

    return defined
}