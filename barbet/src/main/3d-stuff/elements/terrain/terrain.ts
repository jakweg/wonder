import { MetadataField } from '@game'

import { createFromSpec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { TaskType } from '@3d/pipeline/work-scheduler'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import { createArray } from '@utils/array-utils'
import { spec } from './shaders'

interface ChunkSnapshot {
  chunkId: number
  needsRebuild: boolean
  rebuildRequested: boolean
  lastChunkModificationId: number
  lastChunkUploadId: number
  buildResult: null | { top: Uint8Array; sides: Uint8Array }
}

export default (({ pipeline: { gl, visibility }, globals, game, scheduler }) => {
  const implementation = createFromSpec(gl, spec)
  implementation.textures.ambientOcclusion.setSize(
    GENERIC_CHUNK_SIZE * game.world.sizeLevel,
    GENERIC_CHUNK_SIZE * game.world.sizeLevel,
  )

  // TODO improve:
  globals.bindProgramRaw(gl, implementation.programs.default.getPointer())

  let lastWorldUploadChangeId = -1

  const metaData = game.metaData
  const blocksPerAxis = game.world.sizeLevel * GENERIC_CHUNK_SIZE
  const rawBlockData = game.world.rawBlockData
  const rawHeightData = game.world.rawHeightData

  const rawChunkModificationIds = game.world.chunkModificationIds
  let lastWorldChangeId = -1
  const chunks = createArray<ChunkSnapshot>(game.world.chunkModificationIds.length, chunkId => ({
    chunkId,
    lastChunkUploadId: -1,
    lastChunkModificationId: -1,
    needsRebuild: false,
    rebuildRequested: false,
    buildResult: null,
  }))
  const chunksThatNeedUpload: ChunkSnapshot[] = []

  return {
    updateWorldSync() {
      const worldChangeId = metaData[MetadataField.LastWorldChange]!
      if (worldChangeId === lastWorldUploadChangeId) {
        // no change in world
        return
      }
      lastWorldChangeId = worldChangeId

      let chunkIndex = -1
      for (const chunk of chunks) {
        chunkIndex++

        const chunkModificationId = rawChunkModificationIds[chunkIndex]!

        if (chunkModificationId === chunk.lastChunkModificationId) {
          // no change since last rebuild
          continue
        }

        chunk.lastChunkModificationId = chunkModificationId
        chunk.needsRebuild = true
      }
    },
    uploadToGpu(pipeline) {
      const worldChangeId = metaData[MetadataField.LastWorldChange]!
      if (worldChangeId !== lastWorldUploadChangeId) {
        lastWorldUploadChangeId = worldChangeId
        implementation.textures.heightMap.setContentSquare(rawHeightData, blocksPerAxis)
        implementation.textures.terrainType.setContentSquare(rawBlockData, blocksPerAxis)
      }

      for (const chunk of chunksThatNeedUpload) {
        const chunkZ = chunk.chunkId % game.world.sizeLevel | 0
        const chunkX = (chunk.chunkId / game.world.sizeLevel) | 0
        implementation.textures.ambientOcclusion.setPartialContent2D(
          chunk.buildResult!.top,
          chunkX * GENERIC_CHUNK_SIZE,
          chunkZ * GENERIC_CHUNK_SIZE,
          GENERIC_CHUNK_SIZE,
          GENERIC_CHUNK_SIZE,
        )
        // console.log('uploading chunk', chunk)
        // chunk.lastChunkUploadId =
        // TODO upload chunk mesh
      }
      chunksThatNeedUpload.length = 0
    },
    draw(pipeline) {
      const visibleChunksList = visibility.getVisibleChunkIds()
      const visibleChunks = new Uint16Array(visibleChunksList)
      implementation.buffers.visibleChunks.setContent(visibleChunks)

      implementation.programs.default.use()

      const numberOfQuadsPerChunk = GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6 * numberOfQuadsPerChunk, visibleChunksList.length)

      implementation.programs.default.finish()

      for (const chunkIndex of visibleChunks) {
        const chunk = chunks[chunkIndex]!
        if (!chunk.buildResult) continue
        console.log(chunk.buildResult.sides.length)
        implementation.buffers.sidesBuffer.setContent(chunk.buildResult.sides)
        implementation.programs.instancedSides.use()

        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, chunk.buildResult.sides.length / 4)

        implementation.programs.instancedSides.finish()
        break
      }

      for (const chunkIndex of visibleChunks) {
        const chunk = chunks[chunkIndex]!
        if (chunk.needsRebuild && !chunk.rebuildRequested) {
          chunk.rebuildRequested = true
          scheduler.scheduleTask({ type: TaskType.Create2dChunkMesh, chunkIndex }).then(result => {
            if (result.type !== TaskType.Create2dChunkMesh) return
            // console.log('got result for chunk creation', result)
            const chunk = chunks[result.chunkIndex]!
            chunk.rebuildRequested = false
            // if received mesh is out of date then mark the chunk that it still needs rebuild
            chunk.needsRebuild = chunk.lastChunkModificationId !== result.recreationId
            chunk.lastChunkModificationId = result.recreationId
            chunk.buildResult = { sides: result.sides, top: result.top }
            // even if it's out of date try to send it to GPU anyway
            chunksThatNeedUpload.push(chunk)
          })
        }
      }
    },
  }
}) satisfies NewRenderingPipelineElementCreator
