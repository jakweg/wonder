import { InterleavedAttributesLayout } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { GameState } from '@game'
import EntityId, { entityId_asUint32 } from '@game/new-entities/id'
import { EntityKind, getMaxEntitiesByKind } from '@game/new-entities/kind'
import { createEntitiesForDrawingQuery } from '@game/new-entities/stores/queries/entities-for-drawing'
import { createArray } from '@utils/array-utils'
import { EXTRA_INSTANCE_ATTRIBUTE_PREFIX, ExtraInstanceAttributeSpec, SkeletalShader } from './shader'

export interface SkeletalInstanceWriteContext<ExtraAttrName extends string> {
  readonly game: GameState
  readonly elementOffsets: Readonly<Record<ExtraAttrName, number>>
  readonly u32: Uint32Array
  readonly u16: Uint16Array
  readonly u8: Uint8Array
  readonly baseUint32: number
  readonly baseUint16: number
  readonly baseBytes: number
}

type BaseSkeletalInstanceAttrName =
  | 'entityAndTicks'
  | 'tilePosition'
  | 'animationIds'
  | 'headPoses'
  | 'facingAndPreviousFrame'

export interface SkeletalEntityElementOptions<
  BoneName extends string,
  ExtraAttrs extends Record<string, ExtraInstanceAttributeSpec>,
> {
  readonly kind: EntityKind
  readonly shader: SkeletalShader<BoneName, ExtraAttrs>
  readonly writeExtraInstanceAttributes?: (
    entityId: EntityId,
    context: SkeletalInstanceWriteContext<Extract<keyof ExtraAttrs, string>>,
  ) => void
}

/**
 * Creates a complete `NewRenderingPipelineElementCreator` for any skeletal `EntityKind`,
 * handling static mesh upload, chunk-culled entity collection, typed staging buffer packing
 * for `PositionStore` + `FacingStore` + `SkeletalAnimationStore` (+ optional `HeadLookStore`),
 * and instanced WebGL2 drawing.
 */
export const createSkeletalEntityElement = <
  BoneName extends string,
  ExtraAttrs extends Record<string, ExtraInstanceAttributeSpec> = {},
>(
  options: SkeletalEntityElementOptions<BoneName, ExtraAttrs>,
): NewRenderingPipelineElementCreator => {
  const { kind, shader, writeExtraInstanceAttributes } = options
  const { skeleton, hasHeadLook } = shader
  const vertexCount = skeleton.vertexCount

  const extraKeys = Object.keys(shader.extraInstanceAttributes ?? {})
  if (extraKeys.length > 0 && !writeExtraInstanceAttributes) {
    throw new Error(`EntityKind ${kind} declares extraInstanceAttributes but omits writeExtraInstanceAttributes.`)
  }

  return ({ pipeline: { visibility }, globals, game }) => {
    const impl = globals.createGpuResources(shader.spec)
    const meshLayout = impl.buffers.mesh.layout as InterleavedAttributesLayout<'position' | 'normal' | 'boneAndPalette'>
    impl.buffers.mesh.setContent(skeleton.buildMesh(meshLayout))

    const query = createEntitiesForDrawingQuery(game.entities2, visibility, kind)
    const maxEntities = getMaxEntitiesByKind(kind)

    type ExtraAttrName = Extract<keyof ExtraAttrs, string>
    const instanceLayout = impl.buffers.instances.layout as InterleavedAttributesLayout<BaseSkeletalInstanceAttrName>
    const { strideBytes, elementOffsets } = instanceLayout
    const strideUint32 = strideBytes / Uint32Array.BYTES_PER_ELEMENT
    const strideUint16 = strideBytes / Uint16Array.BYTES_PER_ELEMENT

    // Map unprefixed entity attribute keys back to their namespaced `extraAttr_*` offsets once at startup
    const rawElementOffsets = elementOffsets as Readonly<Record<string, number>>
    const rawExtraElementOffsets: Record<string, number> = {}
    for (const key of extraKeys) {
      rawExtraElementOffsets[key] = rawElementOffsets[EXTRA_INSTANCE_ATTRIBUTE_PREFIX + key]!
    }
    const extraElementOffsets = rawExtraElementOffsets as Readonly<Record<ExtraAttrName, number>>

    const stagingBuffer = new ArrayBuffer(maxEntities * strideBytes)
    const u32 = new Uint32Array(stagingBuffer)
    const u16 = new Uint16Array(stagingBuffer)
    const u8 = new Uint8Array(stagingBuffer)

    // Pre-allocated byte views for every possible visible count (0..maxEntities) to avoid per-frame subarray views
    const uploadViews = createArray(maxEntities + 1, count => new Uint8Array(stagingBuffer, 0, count * strideBytes))

    let visibleCount = 0

    return {
      updateWorldSync() {
        visibleCount = query.refresh()

        for (let i = 0; i < visibleCount; ++i) {
          const entityId = query.entityIds[i]!

          const { x, z } = game.entities2.getPosition(entityId)!
          const y = game.world.getHighestBlockHeight_orElse(x, z, 0)

          const baseUint32 = i * strideUint32
          const baseUint16 = i * strideUint16
          const baseBytes = i * strideBytes

          u32[baseUint32 + elementOffsets.entityAndTicks + 0] = entityId_asUint32(entityId)
          u32[baseUint32 + elementOffsets.entityAndTicks + 1] = game.entities2.getSkeletalAnimationStartTick(entityId)
          u32[baseUint32 + elementOffsets.entityAndTicks + 2] = game.entities2.getFacingStartTick(entityId)
          if (hasHeadLook) {
            u32[baseUint32 + elementOffsets.entityAndTicks + 3] = game.entities2.getHeadLookStartTick(entityId)
            u16[baseUint16 + elementOffsets.headPoses + 0] = game.entities2.getPreviousHeadPosePacked(entityId)
            u16[baseUint16 + elementOffsets.headPoses + 1] = game.entities2.getTargetHeadPosePacked(entityId)
          }

          u16[baseUint16 + elementOffsets.tilePosition + 0] = x
          u16[baseUint16 + elementOffsets.tilePosition + 1] = y
          u16[baseUint16 + elementOffsets.tilePosition + 2] = z
          u16[baseUint16 + elementOffsets.animationIds + 0] = game.entities2.getSkeletalAnimationId(entityId)
          u16[baseUint16 + elementOffsets.animationIds + 1] = game.entities2.getPreviousSkeletalAnimationId(entityId)
          u8[baseBytes + elementOffsets.facingAndPreviousFrame + 0] = game.entities2.getFacingPacked(entityId)
          u8[baseBytes + elementOffsets.facingAndPreviousFrame + 1] =
            game.entities2.getPreviousSkeletalAnimationFrame(entityId)

          if (writeExtraInstanceAttributes) {
            writeExtraInstanceAttributes(entityId, {
              game,
              elementOffsets: extraElementOffsets,
              u32,
              u16,
              u8,
              baseUint32,
              baseUint16,
              baseBytes,
            })
          }
        }
      },
      uploadToGpu() {
        if (visibleCount > 0) {
          impl.buffers.instances.setContent(uploadViews[visibleCount]!)
        }
      },
      draw() {
        if (visibleCount > 0) {
          impl.programs.entity.drawArraysInstanced(0, vertexCount, visibleCount)
        }
      },
    }
  }
}
