import * as mat4 from "@matrix/mat4"
import * as vec4 from "@matrix/vec4"
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
        mesh: newCubeModel(0xFF00FF),
        staticTransform: [
        ],
        dynamicTransformCondition: 'true',
        dynamicTransform: [
            { type: TransformType.RotateY, by: `(u_time)` },
            { type: TransformType.Translate, by: [null, `a_modelFlags == 1U ? sin(u_time * 3.0) * 0.5 : 0.0`, null] },
        ]
    })

    console.log(defined);

    return defined
}