import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { getSharedSkeletalPoseAtlas } from '@3d/skeletal/pose-atlas'
import { entityId_asUint32 } from '@game/new-entities/id'
import { EntityKind, getMaxEntitiesByKind } from '@game/new-entities/kind'
import { createEntitiesForDrawingQuery } from '@game/new-entities/stores/queries/entities-for-drawing'
import { createArray } from '@utils/array-utils'
import { STEVE_VERTEX_COUNT, steveSkeleton } from './mesh'
import { spec } from './shaders'

export default (({ pipeline: { visibility }, globals, game }) => {
  const impl = globals.createGpuResources(spec)
  impl.buffers.mesh.setContent(steveSkeleton.buildMesh(impl.buffers.mesh.layout))

  const poseAtlas = getSharedSkeletalPoseAtlas()
  impl.textures.poseAtlas.setContent2D(poseAtlas.texels, poseAtlas.width, poseAtlas.height)

  const query = createEntitiesForDrawingQuery(game.entities2, visibility, EntityKind.Steve)

  const maxSteves = getMaxEntitiesByKind(EntityKind.Steve)
  const { strideBytes, elementOffsets } = impl.buffers.instances.layout
  const strideUint32 = strideBytes / Uint32Array.BYTES_PER_ELEMENT
  const strideUint16 = strideBytes / Uint16Array.BYTES_PER_ELEMENT

  const stagingBuffer = new ArrayBuffer(maxSteves * strideBytes)
  const u32 = new Uint32Array(stagingBuffer)
  const u16 = new Uint16Array(stagingBuffer)
  const u8 = new Uint8Array(stagingBuffer)

  // Pre-allocated byte views for every possible visible count (0..maxSteves) to avoid per-frame subarray views
  const uploadViews = createArray(maxSteves + 1, count => new Uint8Array(stagingBuffer, 0, count * strideBytes))

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

        u32[baseUint32 + elementOffsets.entityAndAppearance + 0] = entityId_asUint32(entityId)
        u32[baseUint32 + elementOffsets.entityAndAppearance + 1] = game.entities2.getSteveAppearanceRaw(entityId)
        u32[baseUint32 + elementOffsets.startTicks + 0] = game.entities2.getSteveAnimationStartTick(entityId)
        u32[baseUint32 + elementOffsets.startTicks + 1] = game.entities2.getSteveHeadLookStartTick(entityId)
        u32[baseUint32 + elementOffsets.startTicks + 2] = game.entities2.getFacingStartTick(entityId)
        u16[baseUint16 + elementOffsets.tilePosition + 0] = x
        u16[baseUint16 + elementOffsets.tilePosition + 1] = y
        u16[baseUint16 + elementOffsets.tilePosition + 2] = z
        u16[baseUint16 + elementOffsets.headPoses + 0] = game.entities2.getStevePreviousHeadPosePacked(entityId)
        u16[baseUint16 + elementOffsets.headPoses + 1] = game.entities2.getSteveTargetHeadPosePacked(entityId)
        u16[baseUint16 + elementOffsets.animationIds + 0] = game.entities2.getSteveAnimationId(entityId)
        u16[baseUint16 + elementOffsets.animationIds + 1] = game.entities2.getStevePreviousAnimationId(entityId)
        u8[baseBytes + elementOffsets.facingAndPreviousFrame + 0] = game.entities2.getFacingPacked(entityId)
        u8[baseBytes + elementOffsets.facingAndPreviousFrame + 1] =
          game.entities2.getStevePreviousAnimationFrame(entityId)
      }
    },
    uploadToGpu() {
      if (visibleCount > 0) {
        impl.buffers.instances.setContent(uploadViews[visibleCount]!)
      }
    },
    draw() {
      if (visibleCount > 0) {
        impl.programs.steve.drawArraysInstanced(0, STEVE_VERTEX_COUNT, visibleCount)
      }
    },
  }
}) satisfies NewRenderingPipelineElementCreator
