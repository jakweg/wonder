import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { entityId_asUint32 } from '@game/new-entities/id'
import { EntityKind, getMaxEntitiesByKind } from '@game/new-entities/kind'
import { createSlimesForDrawingQuery } from '@game/new-entities/stores/queries/slimes-for-drawing'
import { createArray } from '@utils/array-utils'
import { buildSlimeMesh, SLIME_VERTEX_COUNT } from './mesh'
import { spec } from './shaders'

export default (({ pipeline: { visibility }, globals, game }) => {
  const impl = globals.createGpuResources(spec)
  impl.buffers.mesh.setContent(buildSlimeMesh(impl.buffers.mesh.layout))

  const query = createSlimesForDrawingQuery(game.entities2, visibility)

  const maxSlimes = getMaxEntitiesByKind(EntityKind.Slime)
  const { strideBytes, elementOffsets } = impl.buffers.instances.layout
  const strideUint32 = strideBytes / Uint32Array.BYTES_PER_ELEMENT
  const strideUint16 = strideBytes / Uint16Array.BYTES_PER_ELEMENT

  const stagingBuffer = new ArrayBuffer(maxSlimes * strideBytes)
  const stagingUint32 = new Uint32Array(stagingBuffer)
  const stagingUint16 = new Uint16Array(stagingBuffer)
  const stagingBytes = new Uint8Array(stagingBuffer)

  // Pre-allocated byte views for every possible visible count (0..maxSlimes) to avoid per-frame subarray views
  const uploadViews = createArray(maxSlimes + 1, count => new Uint8Array(stagingBuffer, 0, count * strideBytes))

  let visibleCount = 0

  return {
    updateWorldSync() {
      const count = query.refresh()
      visibleCount = count
      const rawIds = query.entityIds

      for (let i = 0; i < count; ++i) {
        const entityId = rawIds[i]!

        const { x, z } = game.entities2.getPosition(entityId)!
        const y = game.world.getHighestBlockHeight_orElse(x, z, 0)

        const baseUint32 = i * strideUint32
        const baseUint16 = i * strideUint16
        const baseBytes = i * strideBytes

        stagingUint32[baseUint32 + elementOffsets.entityId] = entityId_asUint32(entityId)
        stagingUint32[baseUint32 + elementOffsets.animationStartTick] =
          game.entities2.getSlimeAnimationStartTick(entityId)
        stagingUint16[baseUint16 + elementOffsets.positionXZ] = x
        stagingUint16[baseUint16 + elementOffsets.positionXZ + 1] = z
        stagingBytes[baseBytes + elementOffsets.positionY] = y
        stagingBytes[baseBytes + elementOffsets.sizeAndColor] = game.entities2.getSlimeMetadataRaw(entityId)
        stagingBytes[baseBytes + elementOffsets.facing] = game.entities2.getFacingPacked(entityId)
        stagingBytes[baseBytes + elementOffsets.animationId] = game.entities2.getSlimeAnimationId(entityId)
      }
    },
    uploadToGpu() {
      if (visibleCount > 0) {
        impl.buffers.instances.setContent(uploadViews[visibleCount]!)
      }
    },
    draw() {
      if (visibleCount > 0) {
        impl.programs.slime.drawArraysInstanced(0, SLIME_VERTEX_COUNT, visibleCount)
      }
    },
  }
}) satisfies NewRenderingPipelineElementCreator
