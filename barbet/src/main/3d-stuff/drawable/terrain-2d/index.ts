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

interface ShaderCache {
  terrainTypeTexture: GPUTexture
  heightMapTexture: GPUTexture
  shader: GlProgram<Attributes, Uniforms>
}

interface WorldData {
  blocksPerAxis: number
  rawBlockData: Uint8Array
  rawHeightData: Uint8ClampedArray
}

interface BoundData {}

const drawable: () => Drawable<ShaderGlobals, ShaderCache, WorldData, BoundData> = () => ({
  onConfigModified(previous: ShaderCache | null) {
    return false
  },
  createShader: async function (
    allocator: GpuAllocator,
    globals: ShaderGlobals,
    previous: ShaderCache | null,
  ): Promise<ShaderCache> {
    const terrainTypeTexture = allocator.newTexture({ textureSlot: TextureSlot.TerrainType })
    const heightMapTexture = allocator.newTexture({ textureSlot: TextureSlot.HeightMap })

    const shader = await allocator
      .newProgram<Attributes, Uniforms>({
        vertexSource: vertexShaderSource({}),
        fragmentSource: fragmentShaderSource({}),
      })
      .then(globals.bindProgram)

    shader.use()
    allocator.unsafeRawContext().uniform1i(shader.uniforms['terrainType'], terrainTypeTexture.slot)
    allocator.unsafeRawContext().uniform1i(shader.uniforms['heightMap'], heightMapTexture.slot)

    return {
      terrainTypeTexture,
      heightMapTexture,
      shader,
    }
  },
  createWorld(params: LoadParams, previous: WorldData | null): WorldData {
    const blocksPerAxis = params.game.world.sizeLevel * GENERIC_CHUNK_SIZE
    const rawBlockData = params.game.world.rawBlockData
    const rawHeightData = params.game.world.rawHeightData
    return {
      blocksPerAxis,
      rawBlockData,
      rawHeightData,
    }
  },
  async bindWorldData(
    allocator: GpuAllocator,
    shader: ShaderCache,
    data: WorldData,
    previous: BoundData,
  ): Promise<BoundData> {
    return {}
  },
  updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {},
  prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {},
  uploadToGpu(shader: ShaderCache, world: WorldData, bound: BoundData): void {
    shader.heightMapTexture.setContent(world.rawHeightData, world.blocksPerAxis)
    shader.terrainTypeTexture.setContent(world.rawBlockData, world.blocksPerAxis)
  },
  draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    const gl = ctx.gl

    shader.shader.use()

    const numberOfQuads = world.blocksPerAxis * world.blocksPerAxis
    gl.drawArrays(gl.TRIANGLES, 0, 6 * numberOfQuads)
  },
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {},
})

export default drawable
