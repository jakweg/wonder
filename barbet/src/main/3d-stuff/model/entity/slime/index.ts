import { GameTickUniform, RenderTimeUniform, TerrainHeightMultiplierUniform } from '@3d/common-shader'
import { DefinedModelWithAttributes, defineModel, ModelDescription } from '@3d/model/builder'
import { genericEntityRotation } from '@3d/model/builder/common'
import { ModelAttributeType } from '@3d/model/builder/model-attribute-type'
import { DynamicTransform, TransformType } from '@3d/model/builder/transform'
import { newCubeModel } from '@3d/model/entity/slime/cube'
import { DrawableFields, JUMP_DURATION, SLOW_ROTATE_DURATION } from '@game/activities/slime/constants'
import { modelAttributes } from './model-attributes'

const lookingAroundTransformation: DynamicTransform = {
  type: TransformType.RotateY,
  by: `pow(pow(sin(float(a_entityId) + ${RenderTimeUniform} * (0.7 + fract(float(a_entityId) / 9.0))), 5.0), 5.0) * (model.y + 0.5) * 0.3`,
}

const idleBreathingTransformation: DynamicTransform = {
  type: TransformType.Translate,
  by: [null, `(model.y + 0.5) * (sin(float(a_entityId) + ${RenderTimeUniform}) * 0.5 + 0.5) * 0.1`, null],
}

const ownSizeTransformation: DynamicTransform = {
  beforeBlock: `model.y += 0.5;`,
  type: TransformType.Scale,
  by: `float(a_entitySize) / 2.0`,
  afterBlock: `model.y -= 0.5;`,
}

const worldPositionTransformation: DynamicTransform = {
  type: TransformType.Translate,
  by: [
    `float(a_entityPosition.x) + 0.5`,
    `float(a_entityPosition.y) * ${TerrainHeightMultiplierUniform} + 0.5`,
    `float(a_entityPosition.z) + 0.5`,
  ],
}

const jumpTransformation = (): DynamicTransform => ({
  type: TransformType.Translate,
  beforeBlock: `
    float currentTick = mod(${GameTickUniform}, ${(0xff + 1).toFixed(1)});
    float rotationTick = float(a_entityRotationChangeTick);
    float diff = currentTick - rotationTick + (currentTick < rotationTick ? ${(0xff + 1).toFixed(1)} : 0.0);
    float progress = clamp(0.0, 1.0, diff / ${JUMP_DURATION.toFixed(1)});
    float x = progress;
    x = clamp((x - 0.5) * 1.6 + 0.5, 0.0, 1.0);
    float jump = x * (1.0 - x);
    x = progress;
    float scale = -x*x*(x-1.0)*(x-1.0)*(x-0.3)*(x-0.7)*sin(${Math.PI.toFixed(8)}*x);
    `,
  by: [null, `jump * 6.0 * ${TerrainHeightMultiplierUniform} + (model.y + 0.5) * scale * 100.0`, null],
})

type ModelPartDescription = ModelDescription<Uint8Array, typeof modelAttributes>

const enum ModelPart {
  Eye = 0b0001,
  Mouth = 0b0010,
}

const constructGeneric = (
  transformations: DynamicTransform[],
): DefinedModelWithAttributes<Uint8Array, typeof modelAttributes> => {
  const makeEye = (left: boolean): ModelPartDescription => ({
    mesh: newCubeModel(ModelPart.Eye, 0x111111),
    staticTransform: [
      { type: TransformType.Translate, by: [0, 0.25, 0.23 * (left ? -1 : 1)] },
      { type: TransformType.Translate, by: [0.53, 0, 0] },
      { type: TransformType.Scale, by: [0.1, 0.16, 0.16] },
    ],
  })

  const makeMouth = (): ModelPartDescription => ({
    mesh: newCubeModel(ModelPart.Mouth, 0x111111),
    staticTransform: [
      { type: TransformType.Translate, by: [0, -0.15, 0.03] },
      { type: TransformType.Translate, by: [0.53, 0, 0] },
      { type: TransformType.Scale, by: [0.1, 0.12, 0.12] },
    ],
    dynamicTransformCondition: `(modelPart & (${ModelPart.Mouth}U)) == ${ModelPart.Mouth}U`,
    dynamicTransform: [
      {
        type: TransformType.Scale,
        by: [null, null, `pow((sin(${RenderTimeUniform} * 1.0) + 1.0) * 0.5, 20.0) + 1.0`],
      },
    ],
  })

  const makeBody = (): ModelPartDescription => ({
    mesh: newCubeModel(0, 0x00ffff),
    staticTransform: [],
  })

  const defined = defineModel({
    children: [makeEye(true), makeEye(false), makeMouth(), makeBody()],
    staticTransform: [],
    dynamicTransformCondition: 'true',
    dynamicTransform: [...transformations],
  })

  return {
    ...defined,
    copyBytesPerInstanceCount: DrawableFields.SIZE,
    entityAttributes: {
      'Position': ModelAttributeType.UVec3_2,
      'Rotation': ModelAttributeType.Uint,
      'RotationChangeTick': ModelAttributeType.Uint,
      'Color': ModelAttributeType.Vec3_N,
      'Size': ModelAttributeType.Uint,
    },
  }
}

export const constructIdle = () => {
  return constructGeneric([
    genericEntityRotation(5),
    idleBreathingTransformation,
    lookingAroundTransformation,
    ownSizeTransformation,
    worldPositionTransformation,
  ])
}

export const constructSlowlyRotating = () => {
  return constructGeneric([
    genericEntityRotation(`${SLOW_ROTATE_DURATION.toFixed(1)} - model.y * 5.0`),
    idleBreathingTransformation,
    lookingAroundTransformation,
    ownSizeTransformation,
    worldPositionTransformation,
  ])
}

export const constructJumping = () => {
  return constructGeneric([
    genericEntityRotation(JUMP_DURATION),
    idleBreathingTransformation,
    lookingAroundTransformation,
    jumpTransformation(),
    ownSizeTransformation,
    worldPositionTransformation,
  ])
}
