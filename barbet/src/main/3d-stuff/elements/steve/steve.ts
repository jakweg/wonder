import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { entityId_asUint32 } from '@game/new-entities/id'
import { EntityKind, getMaxEntitiesByKind } from '@game/new-entities/kind'
import { createStevesForDrawingQuery } from '@game/new-entities/stores/queries/steves-for-drawing'
import { createArray } from '@utils/array-utils'
import { buildSteveMesh, STEVE_VERTEX_COUNT } from './mesh'
import { spec } from './shaders'

export default (({ pipeline: { visibility }, globals, game }) => {
  const impl = globals.createGpuResources(spec)
  impl.buffers.mesh.setContent(buildSteveMesh(impl.buffers.mesh.layout))

  const query = createStevesForDrawingQuery(game.entities2, visibility)

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

        u32[baseUint32 + elementOffsets.entityId] = entityId_asUint32(entityId)
        u32[baseUint32 + elementOffsets.animationStartTick] = game.entities2.getSteveAnimationStartTick(entityId)
        u32[baseUint32 + elementOffsets.appearance] = game.entities2.getSteveAppearanceRaw(entityId)
        u16[baseUint16 + elementOffsets.positionXZ] = x
        u16[baseUint16 + elementOffsets.positionXZ + 1] = z
        u16[baseUint16 + elementOffsets.positionY] = y
        u16[baseUint16 + elementOffsets.previousHeadPose] = game.entities2.getStevePreviousHeadPosePacked(entityId)
        u16[baseUint16 + elementOffsets.targetHeadPose] = game.entities2.getSteveTargetHeadPosePacked(entityId)
        u8[baseBytes + elementOffsets.facing] = game.entities2.getFacingPacked(entityId)
        u8[baseBytes + elementOffsets.animationId] = game.entities2.getSteveAnimationId(entityId)
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
