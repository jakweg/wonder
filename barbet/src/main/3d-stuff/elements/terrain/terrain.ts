import { GpuAllocator } from '@3d/pipeline/allocator'
import { Drawable, LoadParams } from '@3d/pipeline/drawable'
import { RenderContext, ShaderGlobals } from '@3d/render-context'
import { MetadataField } from '@game'

import ChunkVisibilityIndex from '@3d/drawable/chunk-visibility'
import { createFromSpec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { NewRenderingPipelineElementCreator } from '@3d/new-render-context'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import { createArray } from '@utils/array-utils'
import { spec, SpecImplementation } from './shaders'

interface ShaderCache {
  implementation: SpecImplementation
  lastWorldUploadChangeId: number
}

interface WorldData {
  metaData: Int32Array
  blocksPerAxis: number
  rawBlockData: Uint8Array
  rawHeightData: Uint8ClampedArray
  rawChunkModificationIds: Uint16Array
  lastWorldChangeId: number
  chunks: ChunkSnapshot[]
  visibility: ChunkVisibilityIndex
}

interface BoundData {}

interface ChunkSnapshot {
  needsRebuild: boolean
  lastChunkModificationId: number
  lastChunkUploadId: number
}

const drawable: () => Drawable<ShaderGlobals, ShaderCache, WorldData, BoundData> = () => ({
  onConfigModified(previous: ShaderCache | null) {
    return false
  },
  createShader: async function (
    allocator: GpuAllocator,
    globals: ShaderGlobals,
    previous: ShaderCache | null,
  ): Promise<ShaderCache> {
    const implementation = createFromSpec(allocator.unsafeRawContext(), spec)

    // TODO improve:
    globals.bindProgramRaw(allocator.unsafeRawContext(), implementation.programs.default.getPointer())

    return {
      implementation,
      lastWorldUploadChangeId: -1,
    }
  },
  createWorld(params: LoadParams, previous: WorldData | null): WorldData {
    const blocksPerAxis = params.game.world.sizeLevel * GENERIC_CHUNK_SIZE
    const rawBlockData = params.game.world.rawBlockData
    const rawHeightData = params.game.world.rawHeightData
    const metaData = params.game.metaData
    const rawChunkModificationIds = params.game.world.chunkModificationIds
    const visibility = params.visibility

    const lastWorldChangeId = -1
    const chunks = createArray<ChunkSnapshot>(params.game.world.chunkModificationIds.length, () => ({
      lastChunkUploadId: -1,
      lastChunkModificationId: -1,
      needsRebuild: false,
    }))

    return {
      metaData,
      blocksPerAxis,
      rawBlockData,
      rawHeightData,
      rawChunkModificationIds,
      lastWorldChangeId,
      chunks,
      visibility,
    }
  },
  async bindWorldData(
    allocator: GpuAllocator,
    shader: ShaderCache,
    world: WorldData,
    previous: BoundData,
  ): Promise<BoundData> {
    return {}
  },
  updateWorld(shader: ShaderCache, world: WorldData, bound: BoundData): void {
    // check if world is the same in general, works for >99% ticks
    // const worldChangeId = world.metaData[MetadataField.LastWorldChange]!
    // if (worldChangeId === world.lastWorldChangeId) return
    // world.lastWorldChangeId = worldChangeId
    // // fallback to chunk based checks
    // const chunks = world.chunks
    // for (let i = 0, l = chunks.length; i < l; ++i) {
    //   const chunk = chunks[i]!
    //   if (chunk.lastChunkModificationId === world.rawChunkModificationIds[i]) {
    //     // this chunk is the same as previous tick, do nothing
    //     continue
    //   }
    //   chunk.lastChunkModificationId = world.rawChunkModificationIds[i]!
    //   chunk.needsRebuild = true
    //   // if (!world.visibility.isChunkIndexVisible(i)) {
    //   //   // if not visible then keep as is, no need to update
    //   //   continue
    //   // }
    // }
  },
  prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {},
  uploadToGpu(shader: ShaderCache, world: WorldData, bound: BoundData): void {
    const worldChangeId = world.metaData[MetadataField.LastWorldChange]!
    if (worldChangeId === shader.lastWorldUploadChangeId) return
    shader.lastWorldUploadChangeId = worldChangeId
    shader.implementation.textures.heightMap.setContentSquare(world.rawHeightData, world.blocksPerAxis)
    shader.implementation.textures.terrainType.setContentSquare(world.rawBlockData, world.blocksPerAxis)
  },
  draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    const gl = ctx.gl
    const impl = shader.implementation
    impl.start()

    const visibleChunksList = ctx.visibility.getVisibleChunkIds()
    const visibleChunks = new Uint16Array(visibleChunksList)
    impl.buffers.visibleChunks.setContent(visibleChunks)

    gl.useProgram(null)
    impl.programs.default.use()

    const numberOfQuadsPerChunk = GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6 * numberOfQuadsPerChunk, visibleChunksList.length)

    impl.stop()
  },
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {},
})

export default (({ pipeline: { gl, visibility }, globals, game }) => {
  const implementation = createFromSpec(gl, spec)

  // TODO improve:
  globals.bindProgramRaw(gl, implementation.programs.default.getPointer())

  let lastWorldUploadChangeId = -1

  const metaData = game.metaData
  const blocksPerAxis = game.world.sizeLevel * GENERIC_CHUNK_SIZE
  const rawBlockData = game.world.rawBlockData
  const rawHeightData = game.world.rawHeightData

  // const rawChunkModificationIds = game.world.chunkModificationIds
  // const lastWorldChangeId = -1
  // const chunks = createArray<ChunkSnapshot>(game.world.chunkModificationIds.length, () => ({
  //   lastChunkUploadId: -1,
  //   lastChunkModificationId: -1,
  //   needsRebuild: false,
  // }))

  return {
    updateWorldSync() {},
    uploadToGpu(pipeline) {
      const worldChangeId = metaData[MetadataField.LastWorldChange]!
      if (worldChangeId === lastWorldUploadChangeId) return
      lastWorldUploadChangeId = worldChangeId
      implementation.textures.heightMap.setContentSquare(rawHeightData, blocksPerAxis)
      implementation.textures.terrainType.setContentSquare(rawBlockData, blocksPerAxis)
    },
    draw(pipeline) {
      implementation.start()

      const visibleChunksList = visibility.getVisibleChunkIds()
      const visibleChunks = new Uint16Array(visibleChunksList)
      implementation.buffers.visibleChunks.setContent(visibleChunks)

      gl.useProgram(null)
      implementation.programs.default.use()

      const numberOfQuadsPerChunk = GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6 * numberOfQuadsPerChunk, visibleChunksList.length)

      implementation.stop()
    },
  }
}) satisfies NewRenderingPipelineElementCreator
