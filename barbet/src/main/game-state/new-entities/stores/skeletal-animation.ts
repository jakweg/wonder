import EntityId, { entityId_extractKind } from '@game/new-entities/id'
import { EntityKind, getEntityKindsByStore } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'
import {
  getSteveAnimationDuration,
  isSteveAnimationLooping,
  SteveAnimationId,
} from '@game/new-entities/stores/steve-animation-id'

export const SKELETAL_NO_PREVIOUS_FRAME = 255

const DEFAULT_ANIMATION_ID = 0
const POSE_MAX_FRAME_INDEX = 63

const enum AnimationFields {
  AnimationId,
  PreviousAnimationId,
  PreviousAnimationFrame,
  SIZE,
}

const enum TickFields {
  AnimationStartTick,
  SIZE,
}

export const getSkeletalAnimationDuration = (kind: EntityKind, animationId: number): number => {
  switch (kind) {
    case EntityKind.Steve:
      return getSteveAnimationDuration(animationId as SteveAnimationId)
    default:
      throw new Error(`EntityKind ${kind} has no skeletal animation duration metadata`)
  }
}

export const isSkeletalAnimationLooping = (kind: EntityKind, animationId: number): boolean => {
  switch (kind) {
    case EntityKind.Steve:
      return isSteveAnimationLooping(animationId as SteveAnimationId)
    default:
      throw new Error(`EntityKind ${kind} has no skeletal animation loop metadata`)
  }
}

/**
 * SkeletalAnimationStore tracks generic clip playback and outgoing freeze-frame state
 * for smooth GPU cross-fading across any skeletal entity kind (Steve, animals, boats, etc.).
 */
const Creator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { animationStates, animationTicks },
  } = init.prepareStorage({
    supportedKinds: getEntityKindsByStore(Creator),
    dataBuffers: {
      animationStates: { internalType: Uint8Array, fieldsPerEntity: AnimationFields.SIZE },
      animationTicks: { internalType: Uint32Array, fieldsPerEntity: TickFields.SIZE },
    },
  })

  return {
    read: {
      getSkeletalAnimationId(entityId: EntityId): number {
        return animationStates.getValueForEntity_orElse(entityId, AnimationFields.AnimationId, DEFAULT_ANIMATION_ID)
      },
      getPreviousSkeletalAnimationId(entityId: EntityId): number {
        return animationStates.getValueForEntity_orElse(
          entityId,
          AnimationFields.PreviousAnimationId,
          DEFAULT_ANIMATION_ID,
        )
      },
      getPreviousSkeletalAnimationFrame(entityId: EntityId): number {
        return animationStates.getValueForEntity_orElse(
          entityId,
          AnimationFields.PreviousAnimationFrame,
          SKELETAL_NO_PREVIOUS_FRAME,
        )
      },
      getSkeletalAnimationStartTick(entityId: EntityId): number {
        return animationTicks.getValueForEntity_orElse(entityId, TickFields.AnimationStartTick, 0)
      },
    },
    write: {
      setSkeletalAnimation(entityId: EntityId, animationId: number, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        const kind = entityId_extractKind(entityId)
        const normalizedTick = startTick >>> 0
        const outgoingId = animationStates.getValueForEntity_orThrow(entityId, AnimationFields.AnimationId)

        if (outgoingId === animationId && isSkeletalAnimationLooping(kind, animationId)) {
          animationStates.setValueForEntity_orThrow(
            entityId,
            AnimationFields.PreviousAnimationFrame,
            SKELETAL_NO_PREVIOUS_FRAME,
          )
        } else {
          const outgoingStartTick = animationTicks.getValueForEntity_orThrow(entityId, TickFields.AnimationStartTick)
          const elapsedTicks = (normalizedTick - outgoingStartTick) >>> 0
          const duration = Math.max(1, getSkeletalAnimationDuration(kind, outgoingId))
          const progress = isSkeletalAnimationLooping(kind, outgoingId)
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
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        animationStates.setValueForEntity_orThrow(entityId, AnimationFields.AnimationId, DEFAULT_ANIMATION_ID)
        animationStates.setValueForEntity_orThrow(entityId, AnimationFields.PreviousAnimationId, DEFAULT_ANIMATION_ID)
        animationStates.setValueForEntity_orThrow(
          entityId,
          AnimationFields.PreviousAnimationFrame,
          SKELETAL_NO_PREVIOUS_FRAME,
        )
        animationTicks.setValueForEntity_orThrow(entityId, TickFields.AnimationStartTick, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default Creator
