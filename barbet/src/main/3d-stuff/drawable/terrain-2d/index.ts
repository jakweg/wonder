import { pickViaMouseDefaultFragmentShader } from '@3d/common-shader'
import { GlProgram, GPUBuffer, VertexArray } from '@3d/gpu-resources'
import { AttrType } from '@3d/gpu-resources/program'
import { GpuAllocator } from '@3d/pipeline/allocator'
import { Drawable, LoadParams } from '@3d/pipeline/drawable'
import RenderHelperWorkScheduler, { TaskType } from '@3d/pipeline/work-scheduler'
import { RenderContext, ShaderGlobals } from '@3d/render-context'
import { GameState, MetadataField } from '@game'
import { WORLD_CHUNK_SIZE } from '@game/world/world'
import CONFIG from '@utils/persistence/observable-settings'

import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './shaders'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import GPUTexture from '@3d/gpu-resources/texture'
import { TextureSlot } from '@3d/texture-slot-counter'
import { createArray } from '@utils/array-utils'
import ChunkVisibilityIndex from '@3d/drawable/chunk-visibility'

interface ShaderCache {
  vao: VertexArray
  terrainTypeTexture: GPUTexture
  heightMapTexture: GPUTexture
  shader: GlProgram<Attributes, Uniforms>
  visibleChunksBuffer: GPUBuffer
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
    const vao = allocator.newVao()
    const visibleChunksBuffer = allocator.newBuffer({ dynamic: true, forArray: true })
    const terrainTypeTexture = allocator.newTexture({ textureSlot: TextureSlot.TerrainType })
    const heightMapTexture = allocator.newTexture({ textureSlot: TextureSlot.HeightMap })

    vao.bind()
    const shader = await allocator
      .newProgram<Attributes, Uniforms>({
        vertexSource: vertexShaderSource({}),
        fragmentSource: fragmentShaderSource({}),
      })
      .then(globals.bindProgram)

    shader.use()
    allocator.unsafeRawContext().uniform1i(shader.uniforms['terrainType'], terrainTypeTexture.slot)
    allocator.unsafeRawContext().uniform1i(shader.uniforms['heightMap'], heightMapTexture.slot)
    visibleChunksBuffer.bind()
    shader.useAttributes({
      'thisChunkId': { count: 1, type: AttrType.UShort, divisor: 1 },
    })
    vao.unbind()

    return {
      vao,
      terrainTypeTexture,
      heightMapTexture,
      visibleChunksBuffer,
      shader,
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
    shader.heightMapTexture.setContent(world.rawHeightData, world.blocksPerAxis)
    shader.terrainTypeTexture.setContent(world.rawBlockData, world.blocksPerAxis)
  },
  draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    const gl = ctx.gl

    const visibleChunksList = ctx.visibility.getVisibleChunkIds()
    const visibleChunks = new Uint16Array(visibleChunksList)
    shader.visibleChunksBuffer.setContent(visibleChunks)

    shader.vao.bind()
    shader.shader.use()

    const numberOfQuadsPerChunk = GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE
    shader.heightMapTexture.setActive()
    shader.terrainTypeTexture.setActive()
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6 * numberOfQuadsPerChunk, visibleChunksList.length)

    shader.vao.unbind()
  },
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {},
})

export default drawable
