import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

export const enum SteveAnimationId {
  Idle = 0,
  Walk = 1,
  WalkUp = 2,
  WalkDown = 3,
  WavingHand = 4,
}

export const STEVE_HEAD_TURN_DURATION = 10
export const STEVE_HEAD_MAX_YAW = 0.7
export const STEVE_HEAD_MAX_PITCH = 0.25
export const STEVE_HEAD_CENTER_BYTE = 128
export const STEVE_CENTER_HEAD_POSE = (STEVE_HEAD_CENTER_BYTE << 8) | STEVE_HEAD_CENTER_BYTE

const enum AnimationFields {
  AnimationId,
  SIZE,
}

const enum HeadPoseFields {
  PreviousPose,
  TargetPose,
  SIZE,
}

const enum TickFields {
  StartTick,
  SIZE,
}

const encodeHeadAngle = (radians: number, maxRadians: number): number => {
  const normalized = Math.max(-1, Math.min(1, radians / maxRadians))
  return Math.max(0, Math.min(255, Math.round(normalized * 127 + STEVE_HEAD_CENTER_BYTE)))
}

export const packSteveHeadPose = (yawRadians: number, pitchRadians: number): number => {
  const yawByte = encodeHeadAngle(yawRadians, STEVE_HEAD_MAX_YAW)
  const pitchByte = encodeHeadAngle(pitchRadians, STEVE_HEAD_MAX_PITCH)
  return (pitchByte << 8) | yawByte
}

const interpolateHeadPose = (previousPacked: number, targetPacked: number, elapsedTicks: number): number => {
  if (elapsedTicks >= STEVE_HEAD_TURN_DURATION || previousPacked === targetPacked) {
    return targetPacked
  }
  if (elapsedTicks <= 0) {
    return previousPacked
  }

  const t = elapsedTicks / STEVE_HEAD_TURN_DURATION
  const progress = t * t * (3 - 2 * t)

  const previousYaw = previousPacked & 0xff
  const previousPitch = (previousPacked >> 8) & 0xff
  const targetYaw = targetPacked & 0xff
  const targetPitch = (targetPacked >> 8) & 0xff

  const currentYaw = Math.round(previousYaw + (targetYaw - previousYaw) * progress)
  const currentPitch = Math.round(previousPitch + (targetPitch - previousPitch) * progress)
  return (currentPitch << 8) | currentYaw
}

/**
 * SteveAnimationStore stores SteveAnimationId, previous/target packed head poses (8-bit yaw + 8-bit pitch),
 * and a 32-bit animation start tick per Steve entity.
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { animationIds, headPoses, animationStartTicks },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataBuffers: {
      animationIds: { internalType: Uint8Array, fieldsPerEntity: AnimationFields.SIZE },
      headPoses: { internalType: Uint16Array, fieldsPerEntity: HeadPoseFields.SIZE },
      animationStartTicks: { internalType: Uint32Array, fieldsPerEntity: TickFields.SIZE },
    },
  })

  const captureCurrentHeadPose = (entityId: EntityId, currentTick: number): number => {
    const previousPose = headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose)
    const targetPose = headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose)
    const previousStartTick = animationStartTicks.getValueForEntity_orThrow(entityId, TickFields.StartTick)
    const elapsedTicks = (currentTick - previousStartTick) >>> 0
    return interpolateHeadPose(previousPose, targetPose, elapsedTicks)
  }

  const transitionHeadPose = (entityId: EntityId, nextTargetPose: number, startTick: number): void => {
    const normalizedStartTick = startTick >>> 0
    const currentHeadPose = captureCurrentHeadPose(entityId, normalizedStartTick)
    headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose, currentHeadPose)
    headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose, nextTargetPose)
    animationStartTicks.setValueForEntity_orThrow(entityId, TickFields.StartTick, normalizedStartTick)
  }

  return {
    read: {
      getSteveAnimationId(entityId: EntityId): SteveAnimationId {
        return animationIds.getValueForEntity_orElse(
          entityId,
          AnimationFields.AnimationId,
          SteveAnimationId.Idle,
        ) as SteveAnimationId
      },
      getStevePreviousHeadPosePacked(entityId: EntityId): number {
        return headPoses.getValueForEntity_orElse(entityId, HeadPoseFields.PreviousPose, STEVE_CENTER_HEAD_POSE)
      },
      getSteveTargetHeadPosePacked(entityId: EntityId): number {
        return headPoses.getValueForEntity_orElse(entityId, HeadPoseFields.TargetPose, STEVE_CENTER_HEAD_POSE)
      },
      getSteveAnimationStartTick(entityId: EntityId): number {
        return animationStartTicks.getValueForEntity_orElse(entityId, TickFields.StartTick, 0)
      },
    },
    write: {
      setSteveAnimation(entityId: EntityId, animationId: SteveAnimationId, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        animationIds.setValueForEntity_orThrow(entityId, AnimationFields.AnimationId, animationId)
        transitionHeadPose(entityId, STEVE_CENTER_HEAD_POSE, startTick)
      },
      setSteveHeadLook(entityId: EntityId, targetYaw: number, targetPitch: number, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        transitionHeadPose(entityId, packSteveHeadPose(targetYaw, targetPitch), startTick)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        animationIds.setValueForEntity_orThrow(entityId, AnimationFields.AnimationId, SteveAnimationId.Idle)
        headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose, STEVE_CENTER_HEAD_POSE)
        headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose, STEVE_CENTER_HEAD_POSE)
        animationStartTicks.setValueForEntity_orThrow(entityId, TickFields.StartTick, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
