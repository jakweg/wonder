import GlProgram from '@3d/gpu-resources/program'
import { GpuAllocator } from '@3d/pipeline/allocator'
import { Drawable, LoadParams } from '@3d/pipeline/Drawable'
import { RenderContext } from '@3d/render-context'
import CONFIG from '../../persistance/observable-settings'
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './graph-renderer-shaders'

export const FRAMES_COUNT_RENDERING = 240
export const FRAMES_COUNT_UPDATE = 180

type ShaderCache = null | {
  enabled: boolean
  tps: number
  needsTpsUpdate: boolean
  programFps: GlProgram<Attributes, Uniforms>
  programUps: GlProgram<Attributes, Uniforms>
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

    const makeShader = (samplesCount: number, left: boolean) =>
      allocator.newProgram<Attributes, Uniforms>({
        vertexSource: vertexShaderSource({ samplesCount, left }),
        fragmentSource: fragmentShaderSource({ samplesCount, left }),
      })

    const programs = await Promise['all']([
      makeShader(FRAMES_COUNT_RENDERING, true),
      makeShader(FRAMES_COUNT_UPDATE, false),
    ])

    programs[0].use()
    allocator.unsafeRawContext().uniform1f(programs[0].uniforms['heightScale'], 64.0)
    allocator.unsafeRawContext().uniform1f(programs[0].uniforms['targetMs'], 16.0)

    for (const p of programs) {
      p.use()
      p.rawGl()['vertexAttrib1f'](p.attributes['dummyZero'], 0)
    }

    return {
      programFps: programs[0],
      programUps: programs[1],
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
      stats,
      stats: { frames, updateTimesBuffer },
    } = ctx
    if (shader === null || !shader.enabled) return

    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindVertexArray(null)
    gl['disable'](gl.DEPTH_TEST)
    gl['enable'](gl.BLEND)
    gl['blendFunc'](gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const { programFps, programUps } = shader
    programFps.use()
    gl.uniform1fv(programFps.uniforms['values[0]'], frames.getFrameTimeRaw())
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    stats.incrementDrawCalls()

    if (updateTimesBuffer) {
      programUps.use()
      if (shader.needsTpsUpdate) {
        const targetMilliseconds = 1000 / shader.tps
        gl.uniform1f(programUps.uniforms['targetMs'], targetMilliseconds)
        gl.uniform1f(programUps.uniforms['heightScale'], targetMilliseconds * 4)

        shader.needsTpsUpdate = false
      }
      gl.uniform1fv(programUps.uniforms['values[0]'], new Float32Array(updateTimesBuffer))
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      stats.incrementDrawCalls()
    }

    gl['enable'](gl.DEPTH_TEST)
    gl['disable'](gl.BLEND)

    gl.bindVertexArray(null)
  },
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {},
})

export default drawable
