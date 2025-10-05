import { GpuAllocator } from '@3d/pipeline/allocator'
import { Drawable, LoadParams } from '@3d/pipeline/drawable'
import { RenderContext } from '@3d/render-context'
import CONFIG from '../../persistence/observable-settings'
import { spec, SpecImplementation } from './graph-renderer-shaders'
import { createFromSpec } from '@3d/gpu-resources/ultimate-gpu-pipeline'

export const FRAMES_COUNT_RENDERING = 240
export const FRAMES_COUNT_UPDATE = 180

type ShaderCache = null | {
  impl: SpecImplementation
  enabled: boolean
  tps: number
  needsTpsUpdate: boolean
}

interface WorldData {}

interface BoundData {}

const drawable: () => Drawable<never, ShaderCache, WorldData, BoundData> = () => ({
  onConfigModified(previous: ShaderCache | null) {
    return !previous || CONFIG.get('debug/show-graphs') !== previous.enabled || CONFIG.get('other/tps') !== previous.tps
  },
  createShader: async function (allocator: GpuAllocator, _: never, previous: ShaderCache | null): Promise<ShaderCache> {
    const enabled = CONFIG.get('debug/show-graphs')
    if (!enabled) return previous ? { ...previous, enabled: false } : null

    if (previous) return { ...previous, enabled: true, tps: CONFIG.get('other/tps'), needsTpsUpdate: true }

    const impl = createFromSpec(allocator.unsafeRawContext(), spec)

    impl.programs.fps.use()
    allocator.unsafeRawContext().uniform1f(impl.programs.fps.unsafeUniformLocations.heightScale!, 64.0)
    allocator.unsafeRawContext().uniform1f(impl.programs.fps.unsafeUniformLocations.targetMs!, 16.0)
    allocator.unsafeRawContext().uniform1ui(impl.programs.fps.unsafeUniformLocations.samplesCount!, 240)

    impl.programs.tps.use()
    allocator.unsafeRawContext().uniform1f(impl.programs.tps.unsafeUniformLocations.heightScale!, 64.0)
    allocator.unsafeRawContext().uniform1f(impl.programs.tps.unsafeUniformLocations.targetMs!, 16.0)
    allocator.unsafeRawContext().uniform1ui(impl.programs.tps.unsafeUniformLocations.samplesCount!, 180)

    return {
      impl,
      enabled,
      tps: CONFIG.get('other/tps'),
      needsTpsUpdate: true,
    }
  },
  createWorld(params: LoadParams, previous: WorldData | null): WorldData {
    return {}
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
  uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {},
  draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    const {
      gl,
      stats: { frames, updateTimesBuffer },
    } = ctx

    if (shader === null || !shader.enabled) return

    shader.impl.start()
    gl['disable'](gl.DEPTH_TEST)
    gl['enable'](gl.BLEND)
    gl['blendFunc'](gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    shader.impl.programs.fps.use()
    const frameTime = frames.getFrameTimeRaw()
    shader.impl.textures.fpsSamples.setContent2D(frameTime, frameTime.length, 1)

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    shader.impl.programs.tps.use()
    if (updateTimesBuffer) {
      if (shader.needsTpsUpdate) {
        const targetMilliseconds = 1000 / shader.tps
        gl.uniform1f(shader.impl.programs.tps.unsafeUniformLocations.targetMs, targetMilliseconds)
        gl.uniform1f(shader.impl.programs.tps.unsafeUniformLocations.heightScale, targetMilliseconds * 4)
        shader.needsTpsUpdate = false
      }
      const array = new Float32Array(updateTimesBuffer)
      shader.impl.textures.tpsSamples.setContent2D(array, array.length, 1)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl['enable'](gl.DEPTH_TEST)
    gl['disable'](gl.BLEND)
    shader.impl.stop()
  },
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {},
})

export default drawable
