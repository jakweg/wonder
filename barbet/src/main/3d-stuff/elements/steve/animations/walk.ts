import { defineAnimationClip, SampledClipPose, smoothPulseScalar, smoothstepScalar } from '@3d/skeletal/clip'
import { STEVE_PIXEL_SCALE, SteveBoneName } from '../mesh'

interface StrideOptions {
  readonly armSwingAmplitude: number
  readonly forwardHipScale: number
  readonly climbPulse: number
  readonly dropPulse: number
  readonly crouchAngle: number
}

const applyArticulatedStride = (
  pose: SampledClipPose<SteveBoneName>,
  walkSwing: number,
  options: StrideOptions,
): void => {
  const { armSwingAmplitude, forwardHipScale, climbPulse, dropPulse, crouchAngle } = options
  const balanceAbduction = dropPulse * 0.22 + climbPulse * 0.12

  for (const isLeft of [true, false]) {
    const sign = isLeft ? 1 : -1
    const upperArm = isLeft ? pose.bones.LeftUpperArm : pose.bones.RightUpperArm
    const forearm = isLeft ? pose.bones.LeftForearm : pose.bones.RightForearm
    const walkArmSwing = -walkSwing * armSwingAmplitude * sign

    upperArm.pitch = walkArmSwing
    upperArm.roll = balanceAbduction * sign
    forearm.pitch = Math.max(0, walkArmSwing) * 0.4 + Math.abs(walkSwing) * 0.08 + climbPulse * 0.25

    const thigh = isLeft ? pose.bones.LeftThigh : pose.bones.RightThigh
    const shin = isLeft ? pose.bones.LeftShin : pose.bones.RightShin
    const signedLegSwing = walkSwing * sign

    let hipAngle: number
    let kneeBend: number
    if (signedLegSwing >= 0) {
      hipAngle = signedLegSwing * forwardHipScale
      kneeBend = signedLegSwing * (1 - signedLegSwing) * 0.35 + signedLegSwing * climbPulse * 0.55
    } else {
      const backwardAmount = -signedLegSwing
      hipAngle = -backwardAmount * 0.32
      kneeBend = backwardAmount * 0.48 + backwardAmount * climbPulse * 0.2
    }

    thigh.pitch = hipAngle + crouchAngle
    shin.pitch = -(kneeBend + 2 * crouchAngle)
  }

  pose.bones.Torso.pitch = -climbPulse * 0.16 + dropPulse * 0.06 - crouchAngle * 0.25
  pose.bones.Head.pitch = climbPulse * 0.14 - dropPulse * 0.14
}

export const walkClip = defineAnimationClip<SteveBoneName>({
  blendInTicks: 4,
  stepMovement: true,
  ambientWeight: 0.25,
  evaluate(progress, pose) {
    const walkSwing = Math.sin(progress * Math.PI * 2)
    applyArticulatedStride(pose, walkSwing, {
      armSwingAmplitude: 0.4,
      forwardHipScale: 0.38,
      climbPulse: 0,
      dropPulse: 0,
      crouchAngle: 0,
    })
    pose.localRootOffset[1] = Math.abs(walkSwing) * 0.022
  },
})

export const walkUpClip = defineAnimationClip<SteveBoneName>({
  blendInTicks: 4,
  stepMovement: true,
  ambientWeight: 0.25,
  evaluate(progress, pose) {
    const walkSwing = Math.sin(progress * Math.PI * 2)
    const climbPulse = smoothPulseScalar(0.22, 0.4, 0.5, 0.68, progress)
    const preJumpCrouch = smoothPulseScalar(0.1, 0.23, 0.23, 0.3, progress)
    const landCrouch = smoothPulseScalar(0.61, 0.68, 0.68, 0.84, progress)
    const crouchAngle = preJumpCrouch * 0.22 + landCrouch * 0.24

    applyArticulatedStride(pose, walkSwing, {
      armSwingAmplitude: 0.56,
      forwardHipScale: 0.56,
      climbPulse,
      dropPulse: 0,
      crouchAngle,
    })

    const groundedBounce = progress < 0.28 || progress > 0.64 ? Math.abs(walkSwing) * 0.015 : 0
    const crouchDrop = 12 * STEVE_PIXEL_SCALE * (1 - Math.cos(crouchAngle))
    pose.localRootOffset[1] = groundedBounce - crouchDrop

    if (progress < 0.28) {
      pose.verticalBlocksOffset = -1
    } else if (progress < 0.64) {
      const jumpTime = (progress - 0.28) / 0.36
      pose.verticalBlocksOffset = -1 + 3.28 * jumpTime - 2.28 * jumpTime * jumpTime
    } else {
      pose.verticalBlocksOffset = 0
    }
  },
})

export const walkDownClip = defineAnimationClip<SteveBoneName>({
  blendInTicks: 4,
  stepMovement: true,
  ambientWeight: 0.25,
  evaluate(progress, pose) {
    const walkSwing = Math.sin(progress * Math.PI * 2)
    const dropPulse = smoothPulseScalar(0.22, 0.44, 0.44, 0.78, progress)
    const crouchAngle = smoothPulseScalar(0.76, 0.85, 0.85, 0.98, progress) * 0.22

    applyArticulatedStride(pose, walkSwing, {
      armSwingAmplitude: 0.4,
      forwardHipScale: 0.38,
      climbPulse: 0,
      dropPulse,
      crouchAngle,
    })

    const crouchDrop = 12 * STEVE_PIXEL_SCALE * (1 - Math.cos(crouchAngle))
    pose.localRootOffset[1] = Math.abs(walkSwing) * 0.015 - crouchDrop

    const dropCurve = smoothstepScalar(0.38, 0.84, progress)
    pose.verticalBlocksOffset = 1 - dropCurve + dropPulse * 0.16
  },
})
