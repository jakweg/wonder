import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'
import {
  getSteveAnimationDuration,
  isSteveAnimationLooping,
  SteveAnimationId,
} from '@game/new-entities/stores/steve-animation-id'

export { getSteveAnimationDuration, isSteveAnimationLooping, SteveAnimationId }

export const STEVE_HEAD_TURN_DURATION = 10
export const STEVE_HEAD_MAX_YAW = 0.7
export const STEVE_HEAD_MAX_PITCH = 0.25
export const STEVE_HEAD_CENTER_BYTE = 128
export const STEVE_CENTER_HEAD_POSE = (STEVE_HEAD_CENTER_BYTE << 8) | STEVE_HEAD_CENTER_BYTE
export const STEVE_NO_PREVIOUS_FRAME = 255

const POSE_MAX_FRAME_INDEX = 63

const enum AnimationFields {
  AnimationId,
  PreviousAnimationId,
  PreviousAnimationFrame,
  SIZE,
}

const enum HeadPoseFields {
  PreviousPose,
  TargetPose,
  SIZE,
}

const enum TickFields {
  AnimationStartTick,
  HeadLookStartTick,
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
 * SteveAnimationStore tracks body clip playback, freeze-frame state for cross-fading transitions,
 * and an independent head-look clock so Steve can glance around without resetting body animations.
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { animationStates, headPoses, animationTicks },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataBuffers: {
      animationStates: { internalType: Uint8Array, fieldsPerEntity: AnimationFields.SIZE },
      headPoses: { internalType: Uint16Array, fieldsPerEntity: HeadPoseFields.SIZE },
      animationTicks: { internalType: Uint32Array, fieldsPerEntity: TickFields.SIZE },
    },
  })

  const transitionHeadPose = (entityId: EntityId, nextTargetPose: number, normalizedTick: number): void => {
    const previousPose = headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose)
    const targetPose = headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose)
    const previousHeadTick = animationTicks.getValueForEntity_orThrow(entityId, TickFields.HeadLookStartTick)
    const currentHeadPose = interpolateHeadPose(previousPose, targetPose, (normalizedTick - previousHeadTick) >>> 0)

    headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose, currentHeadPose)
    headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose, nextTargetPose)
    animationTicks.setValueForEntity_orThrow(entityId, TickFields.HeadLookStartTick, normalizedTick)
  }

  return {
    read: {
      getSteveAnimationId(entityId: EntityId): SteveAnimationId {
        return animationStates.getValueForEntity_orElse(
          entityId,
          AnimationFields.AnimationId,
          SteveAnimationId.Idle,
        ) as SteveAnimationId
      },
      getStevePreviousAnimationId(entityId: EntityId): SteveAnimationId {
        return animationStates.getValueForEntity_orElse(
          entityId,
          AnimationFields.PreviousAnimationId,
          SteveAnimationId.Idle,
        ) as SteveAnimationId
      },
      getStevePreviousAnimationFrame(entityId: EntityId): number {
        return animationStates.getValueForEntity_orElse(
          entityId,
          AnimationFields.PreviousAnimationFrame,
          STEVE_NO_PREVIOUS_FRAME,
        )
      },
      getStevePreviousHeadPosePacked(entityId: EntityId): number {
        return headPoses.getValueForEntity_orElse(entityId, HeadPoseFields.PreviousPose, STEVE_CENTER_HEAD_POSE)
      },
      getSteveTargetHeadPosePacked(entityId: EntityId): number {
        return headPoses.getValueForEntity_orElse(entityId, HeadPoseFields.TargetPose, STEVE_CENTER_HEAD_POSE)
      },
      getSteveAnimationStartTick(entityId: EntityId): number {
        return animationTicks.getValueForEntity_orElse(entityId, TickFields.AnimationStartTick, 0)
      },
      getSteveHeadLookStartTick(entityId: EntityId): number {
        return animationTicks.getValueForEntity_orElse(entityId, TickFields.HeadLookStartTick, 0)
      },
    },
    write: {
      setSteveAnimation(entityId: EntityId, animationId: SteveAnimationId, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        const normalizedTick = startTick >>> 0
        const outgoingId = animationStates.getValueForEntity_orThrow(
          entityId,
          AnimationFields.AnimationId,
        ) as SteveAnimationId

        if (outgoingId === animationId && isSteveAnimationLooping(animationId)) {
          animationStates.setValueForEntity_orThrow(
            entityId,
            AnimationFields.PreviousAnimationFrame,
            STEVE_NO_PREVIOUS_FRAME,
          )
        } else {
          const outgoingStartTick = animationTicks.getValueForEntity_orThrow(entityId, TickFields.AnimationStartTick)
          const elapsedTicks = (normalizedTick - outgoingStartTick) >>> 0
          const duration = Math.max(1, getSteveAnimationDuration(outgoingId))
          const progress = isSteveAnimationLooping(outgoingId)
            ? (elapsedTicks % duration) / duration
            : Math.min(1, elapsedTicks / duration)

          animationStates.setValueForEntity_orThrow(entityId, AnimationFields.PreviousAnimationId, outgoingId)
          animationStates.setValueForEntity_orThrow(
            entityId,
            AnimationFields.PreviousAnimationFrame,
            Math.round(progress * POSE_MAX_FRAME_INDEX),
          )
        }

        animationStates.setValueForEntity_orThrow(entityId, AnimationFields.AnimationId, animationId)
        animationTicks.setValueForEntity_orThrow(entityId, TickFields.AnimationStartTick, normalizedTick)

        if (headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose) !== STEVE_CENTER_HEAD_POSE) {
          transitionHeadPose(entityId, STEVE_CENTER_HEAD_POSE, normalizedTick)
        }
      },
      setSteveHeadLook(entityId: EntityId, targetYaw: number, targetPitch: number, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        transitionHeadPose(entityId, packSteveHeadPose(targetYaw, targetPitch), startTick >>> 0)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        animationStates.setValueForEntity_orThrow(entityId, AnimationFields.AnimationId, SteveAnimationId.Idle)
        animationStates.setValueForEntity_orThrow(entityId, AnimationFields.PreviousAnimationId, SteveAnimationId.Idle)
        animationStates.setValueForEntity_orThrow(
          entityId,
          AnimationFields.PreviousAnimationFrame,
          STEVE_NO_PREVIOUS_FRAME,
        )
        headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose, STEVE_CENTER_HEAD_POSE)
        headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose, STEVE_CENTER_HEAD_POSE)
        animationTicks.setValueForEntity_orThrow(entityId, TickFields.AnimationStartTick, 0)
        animationTicks.setValueForEntity_orThrow(entityId, TickFields.HeadLookStartTick, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
