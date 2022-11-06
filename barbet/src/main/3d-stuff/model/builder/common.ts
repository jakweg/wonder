import { GameTickUniform } from '@3d/common-shader'
import { Direction } from '@utils/direction'
import { DynamicTransform, TransformType } from './transform'

export const entityRotationCalculationBlock = (duration: string | number) => `
float current = float(a_entityRotation & ${Direction.MaskCurrentRotation}U);
float previous = float((a_entityRotation & ${Direction.MaskPreviousRotation}U) >> ${Direction.PreviousBitShift});
float currentTick = mod(${GameTickUniform}, ${(0xff + 1).toFixed(1)});
float rotationTick = float(a_entityRotationChangeTick);
float diff = currentTick - rotationTick + (currentTick < rotationTick ? ${(0xff + 1).toFixed(1)} : 0.0);
float progress = smoothstep(0.0, 1.0, smoothstep(0.0, ${
  typeof duration === 'number' ? duration.toFixed(1) : duration
}, diff));
float nextRotation = current - float(((a_entityRotation & ${Direction.MaskRotateCounter}U) >> ${
  Direction.RotateCounterBitShift
}U) * 8U);
float angleValue = mix(previous, nextRotation, progress) * ${Math.PI / 4};
`

export const genericEntityRotation = (rotationDurationTicks: number | string): DynamicTransform => ({
  type: TransformType.RotateY,
  beforeBlock: entityRotationCalculationBlock(rotationDurationTicks),
  by: `angleValue`,
  normalToo: true,
})
