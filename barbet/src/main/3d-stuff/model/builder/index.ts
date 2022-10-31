import * as mat4 from "@matrix/mat4"
import * as vec4 from "@matrix/vec4"
import { RotationXMatrix, RotationYMatrix, RotationZMatrix } from "../../common-shader"
import { DynamicTransform, StaticTransform, TransformType } from "./transform"

interface ModelMesh {
    points: ReadonlyArray<[number, number, number, number]>
    indices: ReadonlyArray<number>
}

type ModelDefinition = (
    {
        mesh: ModelMesh
        children?: undefined
    } | {
        mesh?: undefined
        children: ModelDefinition[]
    }
) & {
    staticTransform: ReadonlyArray<StaticTransform>
    dynamicTransformCondition: string,
    dynamicTransform: ReadonlyArray<DynamicTransform>
}

const newCube = (extra: number) => {
    const points: Array<[number, number, number, number]> = [
        [-0.5, -0.5, -0.5, extra],
        [0.5, -0.5, -0.5, extra],
        [0.5, -0.5, 0.5, extra],
        [-0.5, -0.5, 0.5, extra],
        [-0.5, 0.5, -0.5, extra],
        [0.5, 0.5, -0.5, extra],
        [0.5, 0.5, 0.5, extra],
        [-0.5, 0.5, 0.5, extra],
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

const transformPoints = (points: ReadonlyArray<[number, number, number, number]>, matrix: any) => {
    const tmpVector: [number, number, number, number] = [0, 0, 0, 0]
    const transformed: Array<[number, number, number, number]> = points.map(([x, y, z, extra]) => {
        tmpVector[0] = x
        tmpVector[1] = y
        tmpVector[2] = z
        tmpVector[3] = 1
        vec4.transformMat4(tmpVector, tmpVector, matrix)
        return [tmpVector[0], tmpVector[1], tmpVector[2], extra]
    })
    return transformed
}

const formatNumberOrString = (value: string | number) => {
    return typeof value === 'number' ? value.toFixed(5) : value
}

const shaderCodeFromDynamicTransform = (
    condition: string,
    operations: ReadonlyArray<DynamicTransform>,
    otherShaders: string[]) => {
    const shaderParts = []

    shaderParts.push(`if (`, condition, `) {\n\n`)
    shaderParts.push(...otherShaders,)
    shaderParts.push('\n\n')
    for (const operation of operations) {
        shaderParts.push('{\n')
        if (operation.beforeBlock)
            shaderParts.push(operation.beforeBlock, '\n')

        switch (operation.type) {
            case TransformType.Scale:
                if (operation.by[0] !== null) shaderParts.push(`model.x *= (`, formatNumberOrString(operation.by[0]), `);\n`)
                if (operation.by[1] !== null) shaderParts.push(`model.y *= (`, formatNumberOrString(operation.by[1]), `);\n`)
                if (operation.by[2] !== null) shaderParts.push(`model.z *= (`, formatNumberOrString(operation.by[2]), `);\n`)
                break
            case TransformType.Translate:
                if (operation.by[0] !== null && operation.by[0] !== 0) shaderParts.push(`model.x += (`, formatNumberOrString(operation.by[0]), `);\n`)
                if (operation.by[1] !== null && operation.by[1] !== 0) shaderParts.push(`model.y += (`, formatNumberOrString(operation.by[1]), `);\n`)
                if (operation.by[2] !== null && operation.by[2] !== 0) shaderParts.push(`model.z += (`, formatNumberOrString(operation.by[2]), `);\n`)
                break
            case TransformType.RotateX:
                if (operation.by) {
                    shaderParts.push('{\nfloat _angle = ', operation.by,
                        ';\nmat4 _rotation = ', RotationXMatrix('_angle'),
                        ';\nmodel = (_rotation * vec4(model, 1.0)).xyz;\n}\n')
                }
                break
            case TransformType.RotateY:
                if (operation.by) {
                    shaderParts.push('{\nfloat _angle = ', operation.by,
                        ';\nmat4 _rotation = ', RotationYMatrix('_angle'),
                        ';\nmodel = (_rotation * vec4(model, 1.0)).xyz;\n}\n')
                }
                break
            case TransformType.RotateZ:
                if (operation.by) {
                    shaderParts.push('{\nfloat _angle = ', operation.by,
                        ';\nmat4 _rotation = ', RotationZMatrix('_angle'),
                        ';\nmodel = (_rotation * vec4(model, 1.0)).xyz;\n}\n')
                }
                break
            default:
                throw new Error()
        }
        shaderParts.push('}\n')
    }
    shaderParts.push('}\n\n')

    return shaderParts.join('')
}

type DefinedModel = {
    points: ReadonlyArray<[number, number, number, number]>
    indices: ReadonlyArray<number>
    triangles: number
    shader: string
}

const defineModel = (description: ModelDefinition): DefinedModel => {
    if (description.mesh) {
        const { points, indices } = description.mesh as ModelMesh

        const staticTransform = matrixFromStaticTransform(description.staticTransform)
        const transformed = transformPoints(points, staticTransform)

        const shader = shaderCodeFromDynamicTransform(description.dynamicTransformCondition, description.dynamicTransform, [])

        return { points: transformed, indices, triangles: indices.length, shader }
    } else {
        const children = description.children
        const defined = children.map(e => defineModel(e))

        const points = defined.map(e => e.points).flat()

        let indicesSum = 0
        const indices = []
        for (const c of defined) {
            for (const i of c.indices)
                indices.push(i + indicesSum)

            indicesSum += c.points.length
        }

        const needsConvertStaticToDynamic = description.children.some(c => c.dynamicTransform.length > 0)

        const staticTransform = matrixFromStaticTransform(description.staticTransform)
        const transformed = needsConvertStaticToDynamic ? points : transformPoints(points, staticTransform)

        const shader = shaderCodeFromDynamicTransform(description.dynamicTransformCondition, description.dynamicTransform,
            [...defined.map(e => e.shader), shaderCodeFromDynamicTransform('true', needsConvertStaticToDynamic ? description.staticTransform : [], [])])

        return { points: transformed, indices, triangles: indices.length, shader }
    }
}

export const foo = () => {

    const defined = defineModel({
        children: [
            {
                mesh: newCube(0.9),
                staticTransform: [
                    { type: TransformType.Scale, by: [0.4, 0.4, 0.4] },
                ],
                dynamicTransformCondition: 'a_modelExtra == 0.9',
                dynamicTransform: [
                    { type: TransformType.RotateY, by: `u_time / -1.0` },
                ],
            },
            {
                mesh: newCube(0.2),
                staticTransform: [
                    { type: TransformType.Translate, by: [0, 0, 1] },
                    // { type: TransformType.Translate, by: [1.0, 0.4, 0] },
                    { type: TransformType.Scale, by: [0.2, 0.2, 0.2] },
                ],
                dynamicTransformCondition: 'a_modelExtra == 0.2',
                dynamicTransform: [
                ],
            },
        ],
        staticTransform: [
        ],
        dynamicTransformCondition: 'true',
        dynamicTransform: [
            { type: TransformType.RotateY, by: `(u_time)` },
            { type: TransformType.Translate, by: [1, 0, 2] },
        ]
    })

    console.log(defined);


    return { ...defined, points: defined.points.flat() }
}