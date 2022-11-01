import * as mat4 from "@matrix/mat4"
import { RotationXMatrix, RotationYMatrix, RotationZMatrix } from "../../common-shader"
import { newCubeModel, newCubeModel2 } from "./cube"
import { mergeModels, Model, transformPointsByMatrix, TypedArray } from "./model"
import { DynamicTransform, StaticTransform, TransformType } from "./transform"

type ModelDefinition<T extends TypedArray> = (
    {
        mesh: Model<T>
        children?: undefined
    } | {
        mesh?: undefined
        children: ModelDefinition<T>[]
    }
) & {
    staticTransform: ReadonlyArray<StaticTransform>
    dynamicTransformCondition: string,
    dynamicTransform: ReadonlyArray<DynamicTransform>
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

type DefinedModel<T> = {
    vertexPoints: Float32Array
    indices: Uint16Array
    vertexDataArray: T
    shader: string
}

const defineModel = <T extends TypedArray>(description: ModelDefinition<T>): DefinedModel<T> => {
    if (description.mesh) {
        const model = description.mesh

        const staticTransform = matrixFromStaticTransform(description.staticTransform)
        transformPointsByMatrix(model.vertexPoints, staticTransform)

        const shader = shaderCodeFromDynamicTransform(description.dynamicTransformCondition, description.dynamicTransform, [])

        return { vertexPoints: model.vertexPoints, indices: model.indices, vertexDataArray: model.vertexDataArray, shader }
    } else if (description.children && description.children.length > 0) {
        const children = description.children
        const defined = children.map(e => defineModel(e))

        const merged = mergeModels(defined)

        const needsConvertStaticToDynamic = description.children.some(c => c.dynamicTransform.length > 0)

        const staticTransform = matrixFromStaticTransform(description.staticTransform)
        if (!needsConvertStaticToDynamic)
            transformPointsByMatrix(merged.vertexPoints, staticTransform)

        const shader = shaderCodeFromDynamicTransform(description.dynamicTransformCondition, description.dynamicTransform,
            [...defined.map(e => e.shader), shaderCodeFromDynamicTransform('true', needsConvertStaticToDynamic ? description.staticTransform : [], [])])

        return { vertexPoints: merged.vertexPoints, indices: merged.indices, vertexDataArray: merged.vertexDataArray, shader }
    } else throw new Error()
}

export const foo = () => {

    const defined = defineModel({
        children: [
            {
                mesh: newCubeModel2(0, [
                    0xFF0000,
                    0xFF00FF,
                    0xFFFFFF,
                    0x00FFFF,
                    0x00FF00,
                    0x0000FF,
                ]),
                staticTransform: [
                    { type: TransformType.Scale, by: [1.1, 1, 0.8] }
                ],
                dynamicTransformCondition: 'true',
                dynamicTransform: [],
            },
            {
                mesh: newCubeModel(4, 0xFF0000),
                staticTransform: [
                    { type: TransformType.Translate, by: [0.25, -0.6, -0.29] },
                    { type: TransformType.Scale, by: [0.2, 0.3, 0.2] },
                ],
                dynamicTransformCondition: '(a_modelFlags >> (4U)) == 4U',
                dynamicTransform: [
                    { type: TransformType.Translate, by: [-0.25, 0.3, 0.29] },
                    { type: TransformType.RotateZ, by: 'sin(u_time * 5.0) * 0.2' },
                    { type: TransformType.Translate, by: [0.25, -0.3, -0.29] },
                ],
            }, {
                mesh: newCubeModel(5, 0xFF0000),
                staticTransform: [
                    { type: TransformType.Translate, by: [-0.25, -0.6, -0.29] },
                    { type: TransformType.Scale, by: [0.2, 0.3, 0.2] },
                ],
                dynamicTransformCondition: '(a_modelFlags >> (4U)) == 5U',
                dynamicTransform: [
                    { type: TransformType.Translate, by: [0.25, 0.3, 0.29] },
                    { type: TransformType.RotateZ, by: 'sin(u_time * 5.0) * 0.2' },
                    { type: TransformType.Translate, by: [-0.25, -0.3, -0.29] },
                ],
            },
            {
                mesh: newCubeModel(6, 0xFF0000),
                staticTransform: [
                    { type: TransformType.Translate, by: [0.25, -0.6, 0.29] },
                    { type: TransformType.Scale, by: [0.2, 0.3, 0.2] },
                ],
                dynamicTransformCondition: '(a_modelFlags >> (4U)) == 6U',
                dynamicTransform: [
                    { type: TransformType.Translate, by: [-0.25, 0.3, -0.29] },
                    { type: TransformType.RotateZ, by: 'sin(u_time * -5.0) * 0.2' },
                    { type: TransformType.Translate, by: [0.25, -0.3, 0.29] },
                ],
            }, {
                mesh: newCubeModel(7, 0xFF0000),
                staticTransform: [
                    { type: TransformType.Translate, by: [-0.25, -0.6, 0.29] },
                    { type: TransformType.Scale, by: [0.2, 0.3, 0.2] },
                ],
                dynamicTransformCondition: '(a_modelFlags >> (4U)) == 7U',
                dynamicTransform: [
                    { type: TransformType.Translate, by: [0.25, 0.3, -0.29] },
                    { type: TransformType.RotateZ, by: 'sin(u_time * -5.0) * 0.2' },
                    { type: TransformType.Translate, by: [-0.25, -0.3, 0.29] },
                ],
            },
            {
                children: [
                    {
                        mesh: newCubeModel2(1, [
                            0x0000FF,
                            0xFF0000,
                            0xFF00FF,
                            0x00FFFF,
                            0x00FF00,
                            0xFFFFFF,
                        ]),
                        staticTransform: [
                            { type: TransformType.Scale, by: [0.5, 0.5, 0.5] },
                        ],
                        dynamicTransformCondition: '(a_modelFlags >> (4U)) == 1U',
                        dynamicTransform: [
                        ],
                    },
                    {
                        mesh: newCubeModel(8, 0x000000),
                        staticTransform: [
                            { type: TransformType.Translate, by: [0.22, 0.1, 0.1] },
                            { type: TransformType.Scale, by: [0.09, 0.09, 0.09] },
                        ],
                        dynamicTransformCondition: '(a_modelFlags >> (4U)) == 8U',
                        dynamicTransform: [
                            { type: TransformType.Translate, by: [-0.22, -0.1, -0.1] },
                            {
                                beforeBlock: 'float _v0 = fract(u_time) - 0.1; float _v1 = abs(clamp(_v0, -0.1, 0.1)) * 10.0;float _v2 = abs(clamp(_v0, -0.1, 0.1)) * 2.0 + 0.8;',
                                type: TransformType.Scale, by: [`_v2`, '_v1', '_v2']
                            },
                            { type: TransformType.Translate, by: [0.22, 0.1, 0.1] },
                        ],
                    }, {
                        mesh: newCubeModel(9, 0x000000),
                        staticTransform: [
                            { type: TransformType.Translate, by: [0.22, 0.1, -0.1] },
                            { type: TransformType.Scale, by: [0.09, 0.09, 0.09] },
                        ],
                        dynamicTransformCondition: '(a_modelFlags >> (4U)) == 9U',
                        dynamicTransform: [
                            { type: TransformType.Translate, by: [-0.22, -0.1, 0.1] },
                            {
                                beforeBlock: 'float _v0 = fract(u_time) - 0.1; float _v1 = abs(clamp(_v0, -0.1, 0.1)) * 10.0;float _v2 = abs(clamp(_v0, -0.1, 0.1)) * 2.0 + 0.8;',
                                type: TransformType.Scale, by: [`_v2`, '_v1', '_v2']
                            },
                            { type: TransformType.Translate, by: [0.22, 0.1, -0.1] },
                        ],
                    }, {
                        mesh: newCubeModel(3, 0x000000),
                        staticTransform: [
                            { type: TransformType.Translate, by: [0.22, -0.1, 0] },
                            { type: TransformType.Scale, by: [0.09, 0.07, 0.3] },
                        ],
                        dynamicTransformCondition: 'true',
                        dynamicTransform: [
                        ],
                    },
                ],
                staticTransform: [
                ],
                dynamicTransformCondition: '(a_modelFlags >> (4U)) == 1U || (a_modelFlags >> (4U)) == 3U|| (a_modelFlags >> (4U)) == 8U|| (a_modelFlags >> (4U)) == 9U',
                dynamicTransform: [
                    { type: TransformType.Translate, by: [0.1, 0.1, 0] },
                    { type: TransformType.RotateZ, by: 'sin(u_time * 5.0) / 8.0' },
                    { type: TransformType.RotateY, by: 'sin(u_time) / 3.0' },
                    { type: TransformType.Translate, by: [0.5, 0.5, 0] },
                ],
            }
        ],
        staticTransform: [
            { type: TransformType.Translate, by: [0, 1.5, 0] },
        ],
        dynamicTransformCondition: 'true',
        dynamicTransform: [
            { type: TransformType.RotateY, by: `(u_time)` },
            // { type: TransformType.Translate, by: [null, `a_modelFlags == 1U ? sin(u_time * 3.0) * 0.5 : 0.0`, null] },
        ]
    })

    console.log(defined);

    return defined
}