import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { TaskType } from '@3d/pipeline/work-scheduler'
import { MetadataField } from '@game'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import TypedArray from '@seampan/typed-array'
import { createArray } from '@utils/array-utils'
import { BYTES_PER_VERTEX, spec } from './shaders'

interface ChunkSnapshot {
  chunkId: number
  needsRebuild: boolean
  rebuildRequested: boolean
  lastChunkModificationId: number
  gpuBufferVertexOffset: number
  modelVertexCount: number
  buildResult: null | { top: TypedArray; sides: TypedArray }
}

export default (({ pipeline: { visibility }, globals, game, scheduler }) => {
  const implementation = globals.createGpuResources(spec)
  implementation.textures.ambientOcclusion.setSize(
    GENERIC_CHUNK_SIZE * game.world.sizeLevel,
    GENERIC_CHUNK_SIZE * game.world.sizeLevel,
  )

  let lastWorldUploadChangeId = -1

  let cacheDrawChunksCount = 0
  const cacheFirstsBuffer = new Int32Array(game.world.sizeLevel * game.world.sizeLevel)
  const cacheCountsBuffer = new Int32Array(game.world.sizeLevel * game.world.sizeLevel)

  const metaData = game.metaData
  const blocksPerAxis = game.world.sizeLevel * GENERIC_CHUNK_SIZE
  const rawBlockData = game.world.rawBlockData
  const rawHeightData = game.world.rawHeightData

  const rawChunkModificationIds = game.world.chunkModificationIds
  let lastWorldChangeId = -1
  const chunks = createArray<ChunkSnapshot>(game.world.chunkModificationIds.length, chunkId => ({
    chunkId,
    lastChunkModificationId: -1,
    needsRebuild: false,
    rebuildRequested: false,
    buildResult: null,
    gpuBufferVertexOffset: -1,
    modelVertexCount: 0,
  }))
  const chunksThatNeedUpload: ChunkSnapshot[] = []

  function prepareCacheAndChunksBeforeDraw(visibleChunkIds: readonly number[]) {
    let drawChunksCount = 0
    for (const chunkIndex of visibleChunkIds) {
      const chunk = chunks[chunkIndex]!

      if (chunk.needsRebuild && !chunk.rebuildRequested) {
        chunk.rebuildRequested = true
        scheduler.scheduleTask({ type: TaskType.Create2dChunkMesh, chunkIndex }).then(result => {
          if (result.type !== TaskType.Create2dChunkMesh) return
          const chunk = chunks[result.chunkIndex]!
          chunk.rebuildRequested = false
          // if received mesh is out of date then mark the chunk that it still needs rebuild
          chunk.needsRebuild = chunk.lastChunkModificationId !== result.recreationId
          chunk.lastChunkModificationId = result.recreationId
          chunk.buildResult = {
            sides: result.sides,
            top: result.top,
          }
          // even if it's out of date try to send it to GPU anyway
          chunksThatNeedUpload.push(chunk)
        })
      }

      if (chunk.modelVertexCount > 0) {
        cacheFirstsBuffer[drawChunksCount] = chunk.gpuBufferVertexOffset
        cacheCountsBuffer[drawChunksCount] = chunk.modelVertexCount
        drawChunksCount++
      }
    }
    cacheDrawChunksCount = drawChunksCount
  }

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
    uploadToGpu() {
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

        const oldByteOffset = (chunk.gpuBufferVertexOffset * BYTES_PER_VERTEX) | 0
        const newByteOffset = implementation.buffers.sidesBuffer.replaceContent(oldByteOffset, chunk.buildResult!.sides)
        chunk.gpuBufferVertexOffset = (newByteOffset / BYTES_PER_VERTEX) | 0
        chunk.modelVertexCount = (chunk.buildResult!.sides.byteLength / BYTES_PER_VERTEX) | 0
      }
      chunksThatNeedUpload.length = 0
    },
    draw() {
      const visibleChunksList = visibility.getVisibleChunkIds()
      prepareCacheAndChunksBeforeDraw(visibleChunksList)

      const visibleChunks = new Uint16Array(visibleChunksList)
      implementation.buffers.visibleChunks.setContent(visibleChunks)

      const numberOfQuadsPerChunk = GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE
      implementation.programs.tops.drawArraysInstanced(0, 6 * numberOfQuadsPerChunk, visibleChunksList.length)

      implementation.programs.sides.multiDrawArrays(cacheFirstsBuffer, cacheCountsBuffer, cacheDrawChunksCount)
    },
  }
}) satisfies NewRenderingPipelineElementCreator
