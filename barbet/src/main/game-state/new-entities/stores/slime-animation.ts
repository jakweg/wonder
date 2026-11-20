import EntityId from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import { StoreDescription, StoreInitializer } from '@game/new-entities/stores/factory'

export const enum SlimeAnimationId {
  Idle = 0,
  SlowRotate = 1,
  Jump = 2,
  JumpForward = 3,
}

const enum IdFields {
  AnimationId,
  SIZE,
}

const enum TickFields {
  StartTick,
  SIZE,
}

/**
 * SlimeAnimationStore stores an 8-bit SlimeAnimationId and a 32-bit animation start tick per slime entity
 */
const SlimeAnimationStoreCreator = (init: StoreInitializer) => {
  const {
    isEntitySupported,
    storage: { animationIds, animationStartTicks },
  } = init.prepareStorage({
    supportedKinds: [EntityKind.Slime],
    dataBuffers: {
      animationIds: { internalType: Uint8Array, fieldsPerEntity: IdFields.SIZE },
      animationStartTicks: { internalType: Uint32Array, fieldsPerEntity: TickFields.SIZE },
    },
  })

  return {
    read: {
      getSlimeAnimationId(entityId: EntityId): SlimeAnimationId {
        return animationIds.getValueForEntity_orElse(
          entityId,
          IdFields.AnimationId,
          SlimeAnimationId.Idle,
        ) as SlimeAnimationId
      },
      getSlimeAnimationStartTick(entityId: EntityId): number {
        return animationStartTicks.getValueForEntity_orElse(entityId, TickFields.StartTick, 0)
      },
    },
    write: {
      setSlimeAnimation(entityId: EntityId, animationId: SlimeAnimationId, startTick: number): void {
        if (!isEntitySupported(entityId)) return

        animationIds.setValueForEntity_orThrow(entityId, IdFields.AnimationId, animationId)
        animationStartTicks.setValueForEntity_orThrow(entityId, TickFields.StartTick, startTick >>> 0)
      },
    },
    lifecycle: {
      onEntityAllocated(entityId: EntityId): void {
        if (!isEntitySupported(entityId)) return

        animationIds.setValueForEntity_orThrow(entityId, IdFields.AnimationId, SlimeAnimationId.Idle)
        animationStartTicks.setValueForEntity_orThrow(entityId, TickFields.StartTick, 0)
      },
    },
  } satisfies StoreDescription<object, object>
}

export default SlimeAnimationStoreCreator
