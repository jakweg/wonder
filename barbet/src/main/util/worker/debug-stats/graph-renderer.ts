import { VertexArray } from "../../../3d-stuff/gpu-resources"
import GlProgram, { AttrType } from "../../../3d-stuff/gpu-resources/program"
import { GpuAllocator } from "../../../3d-stuff/pipeline/allocator"
import { Drawable, LoadParams } from "../../../3d-stuff/pipeline/Drawable"
import { RenderContext } from "../../../3d-stuff/renderable/render-context"
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from "./graph-renderer-shaders"


interface ShaderCache {
    program: GlProgram<Attributes, Uniforms>
    vao: VertexArray
}

interface WorldData {
}

interface BoundData {
}

const drawable: (frameStatsCount: number) => Drawable<ShaderCache, WorldData, BoundData> = (frameStatsCount: number) => ({
    onConfigModified(previous: ShaderCache | null) {
        return false
    },
    createShader: async function (allocator: GpuAllocator, previous: ShaderCache | null): Promise<ShaderCache> {
        if (previous) return previous
        const vao = allocator.newVao()
        const trianglesBuffer = allocator.newBuffer({ dynamic: true, forArray: true })
        const options = { samplesCount: frameStatsCount }
        const program = await allocator.newProgram<Attributes, Uniforms>({
            vertexSource: vertexShaderSource(options),
            fragmentSource: fragmentShaderSource(options)
        })

        vao.bind()

        const p1x = -1
        const p1y = -1
        const p2x = 1
        const p2y = 1

        trianglesBuffer.setContent(new Float32Array([
            p1x, p2y,
            p1x, p1y,
            p2x, p1y,

            p2x, p2y,
            p1x, p2y,
            p2x, p1y,
        ]))

        program.useAttributes({
            'position': { count: 2, type: AttrType.Float },
        })
        program.use()
        allocator.unsafeRawContext().uniform1f(program.uniforms['width'], p2x - p1x)

        return {
            program,
            vao,
        }
    },
    createWorld(params: LoadParams, previous: WorldData | null): WorldData {
        return {}
    },
    async bindWorldData(allocator: GpuAllocator, shader: ShaderCache, data: WorldData, previous: BoundData): Promise<BoundData> {
        return {}
    },
    updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    },
    prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {
    },
    uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    },
    draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
        const { gl, stats } = ctx
        const { program, vao } = shader
        program.use()

        vao.bind()

        gl.uniform1fv(program.uniforms['values[0]'], stats.getFrameTimeRaw())

        gl.disable(gl.DEPTH_TEST)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        stats.incrementDrawCalls()
        gl.enable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)

        gl.bindVertexArray(null)

    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    }
})

export default drawable