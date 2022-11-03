import * as mat4 from "@matrix/mat4"
import { RotationXMatrix, RotationYMatrix, RotationZMatrix } from "../../common-shader"
import { newCubeModel } from "./cube"
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
                mat4.scale(matrix, matrix, typeof operation.by === 'number' ? [operation.by, operation.by, operation.by] : operation.by)
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
                if (Array.isArray(operation.by)) {
                    if (operation.by[0] !== null) shaderParts.push(`model.x *= (`, formatNumberOrString(operation.by[0]), `);\n`)
                    if (operation.by[1] !== null) shaderParts.push(`model.y *= (`, formatNumberOrString(operation.by[1]), `);\n`)
                    if (operation.by[2] !== null) shaderParts.push(`model.z *= (`, formatNumberOrString(operation.by[2]), `);\n`)
                } else if (operation.by !== null) {
                    shaderParts.push(`model *= (`, formatNumberOrString(operation.by), `);\n`)
                }
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
                        ';\nmodel = (_rotation * vec4(model, 1.0)).xyz;\n')
                    if (operation.normalToo === true) {
                        shaderParts.push('normal = (_rotation * vec4(normal, 1.0)).xyz;\n')
                    }
                    shaderParts.push('}\n')
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
    const enum ModelPart {
        Eye = 0b0001,
        Mouth = 0b0010,
    }

    const makeEye = (left: boolean): ModelDefinition<Uint8Array> => ({
        mesh: newCubeModel(ModelPart.Eye, 0x111111),
        staticTransform: [
            { type: TransformType.Translate, by: [0, 0.25, 0.23 * (left ? -1 : 1)] },
            { type: TransformType.Translate, by: [0.55, 0, 0] },
            { type: TransformType.Scale, by: [0.04, 0.16, 0.16] },
        ],
        dynamicTransformCondition: 'true',
        dynamicTransform: [],
    })

    const makeMouth = (): ModelDefinition<Uint8Array> => ({
        mesh: newCubeModel(ModelPart.Mouth, 0x111111),
        staticTransform: [
            { type: TransformType.Translate, by: [0, -0.15, 0.03] },
            { type: TransformType.Translate, by: [0.55, 0, 0] },
            { type: TransformType.Scale, by: [0.04, 0.12, 0.12] },
        ],
        dynamicTransformCondition: `(modelPart & (${ModelPart.Mouth}U)) == ${ModelPart.Mouth}U`,
        dynamicTransform: [
            {
                type: TransformType.Scale, by: [
                    null,
                    null,
                    `pow((sin(u_time * 1.0) + 1.0) * 0.5, 20.0) + 1.0`]
            },
        ],
    })

    const defined = defineModel({
        children: [
            makeEye(true),
            makeEye(false),
            makeMouth(),
            {
                mesh: newCubeModel(0, 0x00FFFF),
                staticTransform: [
                    // { type: TransformType.Scale, by: [0.5, 0.5, 0.5] }
                ],
                dynamicTransformCondition: 'true',
                dynamicTransform: [
                    // { type: TransformType.RotateY, by: `sin(u_time * float(a_modelFlags & 1U)) * 0.2`, normalToo: true },
                ],
            }
        ],
        staticTransform: [
        ],
        dynamicTransformCondition: 'true',
        dynamicTransform: [
            { type: TransformType.RotateY, by: `float(a_entityId) * ${Math.PI / 4}`, normalToo: true },
            { type: TransformType.RotateY, by: `pow(pow(sin(float(a_entityId) + u_time * (1.0 + float(a_entityId) / 9.0)), 5.0), 5.0) * (model.y + 0.5) * 0.3`, },
            {
                type: TransformType.Translate, by: [
                    null,
                    `(model.y + 0.5) * (sin(float(a_entityId) + u_time) * 0.5 + 0.5) * 0.1`,
                    null,
                ],
            },
            { type: TransformType.Translate, by: [`float(a_entityPosition.x) + 0.5`, `float(a_entityPosition.y) * terrainHeightMultiplier + 0.5`, `float(a_entityPosition.z) + 0.5`] },
            // {
            // type: TransformType.Translate, by: [null,
            // `clamp(sin(u_time * 10.0), 0.0, 1.0)`,
            //     null]
            // },
        ]
    })

    console.log(defined);

    return defined
}