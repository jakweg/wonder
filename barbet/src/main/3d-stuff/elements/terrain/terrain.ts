import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { TaskType } from '@3d/pipeline/work-scheduler'
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

export default (({ pipeline: { visibility, terrainSnapshot }, globals, game, scheduler }) => {
  const blocksPerAxis = terrainSnapshot.blocksPerAxis
  const implementation = globals.createGpuResources(spec)
  implementation.textures.heightMap.setSize(blocksPerAxis, blocksPerAxis)
  implementation.textures.terrainType.setSize(blocksPerAxis, blocksPerAxis)
  implementation.textures.ambientOcclusion.setSize(blocksPerAxis, blocksPerAxis)

  let lastSyncedWorldChangeId = -1
  let worldTexturesNeedUpload = false

  let cacheDrawChunksCount = 0
  let visibleChunksCount = 0
  const totalChunksCount = terrainSnapshot.sizeLevel * terrainSnapshot.sizeLevel
  const cacheFirstsBuffer = new Int32Array(totalChunksCount)
  const cacheCountsBuffer = new Int32Array(totalChunksCount)
  const visibleChunksStaging = new Uint16Array(totalChunksCount)
  const visibleChunksUploadViews = createArray(
    totalChunksCount + 1,
    count => new Uint16Array(visibleChunksStaging.buffer, 0, count),
  )

  const rawChunkModificationIds = game.world.chunkModificationIds
  const chunks = createArray<ChunkSnapshot>(rawChunkModificationIds.length, chunkId => ({
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
      const worldChangeId = terrainSnapshot.lastWorldChangeId
      if (worldChangeId === lastSyncedWorldChangeId) {
        // no change in world
        return
      }
      lastSyncedWorldChangeId = worldChangeId
      worldTexturesNeedUpload = true

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
      if (worldTexturesNeedUpload) {
        worldTexturesNeedUpload = false
        implementation.textures.heightMap.setContentSquare(terrainSnapshot.heightData, blocksPerAxis)
        implementation.textures.terrainType.setContentSquare(terrainSnapshot.blockData, blocksPerAxis)
      }

      for (const chunk of chunksThatNeedUpload) {
        const chunkZ = (chunk.chunkId % terrainSnapshot.sizeLevel) | 0
        const chunkX = (chunk.chunkId / terrainSnapshot.sizeLevel) | 0
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

      const visibleChunksList = visibility.getVisibleChunkIds()
      prepareCacheAndChunksBeforeDraw(visibleChunksList)

      visibleChunksCount = visibleChunksList.length
      if (visibleChunksCount > 0) {
        for (let i = 0; i < visibleChunksCount; ++i) {
          visibleChunksStaging[i] = visibleChunksList[i]!
        }
        implementation.buffers.visibleChunks.setContent(visibleChunksUploadViews[visibleChunksCount]!)
      }
    },
    draw() {
      if (visibleChunksCount === 0) return

      const numberOfQuadsPerChunk = GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE
      implementation.programs.tops.drawArraysInstanced(0, 6 * numberOfQuadsPerChunk, visibleChunksCount)

      if (cacheDrawChunksCount > 0) {
        implementation.programs.sides.multiDrawArrays(cacheFirstsBuffer, cacheCountsBuffer, cacheDrawChunksCount)
      }
    },
  }
}) satisfies NewRenderingPipelineElementCreator
