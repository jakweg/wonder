import { defineModel, ModelDefinition } from "../builder"
import { newCubeModel } from "../builder/cube"
import { TransformType } from "../builder/transform"

const construct = () => {

    const enum ModelPart {
        Eye = 0b0001,
        Mouth = 0b0010,
    }

    const makeEye = (left: boolean): ModelDefinition<Uint8Array> => ({
        mesh: newCubeModel(ModelPart.Eye, 0x111111),
        staticTransform: [
            { type: TransformType.Translate, by: [0, 0.25, 0.23 * (left ? -1 : 1)] },
            { type: TransformType.Translate, by: [0.53, 0, 0] },
            { type: TransformType.Scale, by: [0.1, 0.16, 0.16] },
        ],
    })

    const makeMouth = (): ModelDefinition<Uint8Array> => ({
        mesh: newCubeModel(ModelPart.Mouth, 0x111111),
        staticTransform: [
            { type: TransformType.Translate, by: [0, -0.15, 0.03] },
            { type: TransformType.Translate, by: [0.53, 0, 0] },
            { type: TransformType.Scale, by: [0.1, 0.12, 0.12] },
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

    const makeBody = (): ModelDefinition<Uint8Array> => ({
        mesh: newCubeModel(0, 0x00FFFF),
        staticTransform: [],
    })


    const defined = defineModel({
        children: [
            makeEye(true),
            makeEye(false),
            makeMouth(),
            makeBody()
        ],
        staticTransform: [
        ],
        dynamicTransformCondition: 'true',
        dynamicTransform: [
            { type: TransformType.RotateY, by: `float(a_entityRotation) * ${Math.PI / 4}`, normalToo: true },
            { type: TransformType.RotateY, by: `pow(pow(sin(float(a_entityId) + u_time * (0.7 + fract(float(a_entityId) / 9.0))), 5.0), 5.0) * (model.y + 0.5) * 0.3`, },
            {
                type: TransformType.Translate, by: [
                    null,
                    `(model.y + 0.5) * (sin(float(a_entityId) + u_time) * 0.5 + 0.5) * 0.1`,
                    null,
                ],
            },
            { beforeBlock: `model.y += 0.5;`, type: TransformType.Scale, by: `float(a_entitySize) / 2.0`, afterBlock: `model.y -= 0.5;` },
            { type: TransformType.Translate, by: [`float(a_entityPosition.x) + 0.5`, `float(a_entityPosition.y) * terrainHeightMultiplier + 0.5`, `float(a_entityPosition.z) + 0.5`] },
            { type: TransformType.Translate, by: [null, `pow(sin(1.321 * float(a_entityId) + u_time * (0.7 + fract(float(a_entityId) / 9.0))), 30.0) * float(a_entitySize) * 0.5`, null] },
        ]
    })

    return defined
}

export default construct