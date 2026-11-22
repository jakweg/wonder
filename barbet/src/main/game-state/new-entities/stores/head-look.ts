import EntityId from '@game/new-entities/id'
import { getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

export const HEAD_TURN_DURATION = 10
export const HEAD_MAX_YAW = 0.7
export const HEAD_MAX_PITCH = 0.25
export const HEAD_CENTER_BYTE = 128
export const CENTER_HEAD_POSE = (HEAD_CENTER_BYTE << 8) | HEAD_CENTER_BYTE

const enum HeadPoseFields {
  PreviousPose,
  TargetPose,
  SIZE,
}

const enum TickFields {
  HeadLookStartTick,
  SIZE,
}

const encodeHeadAngle = (radians: number, maxRadians: number): number => {
  const normalized = Math.max(-1, Math.min(1, radians / maxRadians))
  return Math.max(0, Math.min(255, Math.round(normalized * 127 + HEAD_CENTER_BYTE)))
}

export const packHeadPose = (yawRadians: number, pitchRadians: number): number => {
  const yawByte = encodeHeadAngle(yawRadians, HEAD_MAX_YAW)
  const pitchByte = encodeHeadAngle(pitchRadians, HEAD_MAX_PITCH)
  return (pitchByte << 8) | yawByte
}

const interpolateHeadPose = (previousPacked: number, targetPacked: number, elapsedTicks: number): number => {
  if (elapsedTicks >= HEAD_TURN_DURATION || previousPacked === targetPacked) {
    return targetPacked
  }
  if (elapsedTicks <= 0) {
    return previousPacked
  }

  const t = elapsedTicks / HEAD_TURN_DURATION
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
 * HeadLookStore tracks smooth 2-axis head yaw/pitch interpolation on its own clock,
 * reusable by Steve and animals while omitted by headless entities such as boats.
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { headPoses, headLookTicks },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataBuffers: {
      headPoses: { internalType: Uint16Array, fieldsPerEntity: HeadPoseFields.SIZE },
      headLookTicks: { internalType: Uint32Array, fieldsPerEntity: TickFields.SIZE },
    },
  })

  const transitionHeadPose = (entityId: EntityId, nextTargetPose: number, normalizedTick: number): void => {
    const previousPose = headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose)
    const targetPose = headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose)
    const previousHeadTick = headLookTicks.getValueForEntity_orThrow(entityId, TickFields.HeadLookStartTick)
    const currentHeadPose = interpolateHeadPose(previousPose, targetPose, (normalizedTick - previousHeadTick) >>> 0)

    headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose, currentHeadPose)
    headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose, nextTargetPose)
    headLookTicks.setValueForEntity_orThrow(entityId, TickFields.HeadLookStartTick, normalizedTick)
  }

  return {
    read: {
      getPreviousHeadPosePacked(entityId: EntityId): number {
        return headPoses.getValueForEntity_orElse(entityId, HeadPoseFields.PreviousPose, CENTER_HEAD_POSE)
      },
      getTargetHeadPosePacked(entityId: EntityId): number {
        return headPoses.getValueForEntity_orElse(entityId, HeadPoseFields.TargetPose, CENTER_HEAD_POSE)
      },
      getHeadLookStartTick(entityId: EntityId): number {
        return headLookTicks.getValueForEntity_orElse(entityId, TickFields.HeadLookStartTick, 0)
      },
    },
    write: {
      setHeadLook(entityId: EntityId, targetYaw: number, targetPitch: number, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        transitionHeadPose(entityId, packHeadPose(targetYaw, targetPitch), startTick >>> 0)
      },
      resetHeadLook(entityId: EntityId, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        if (headPoses.getValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose) !== CENTER_HEAD_POSE) {
          transitionHeadPose(entityId, CENTER_HEAD_POSE, startTick >>> 0)
        }
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.PreviousPose, CENTER_HEAD_POSE)
        headPoses.setValueForEntity_orThrow(entityId, HeadPoseFields.TargetPose, CENTER_HEAD_POSE)
        headLookTicks.setValueForEntity_orThrow(entityId, TickFields.HeadLookStartTick, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
