import { toGl } from '@matrix/common'
import { GlProgram, VertexArray } from '../../gpu-resources'
import { AttrType } from '../../gpu-resources/program'
import { foo } from '../../model/builder/index'
import { GpuAllocator } from "../../pipeline/allocator"
import { Drawable, LoadParams } from "../../pipeline/Drawable"
import { RenderContext } from "../../renderable/render-context"
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './shaders'

interface ShaderCache {
    program: GlProgram<Attributes, Uniforms>
    vao: VertexArray
    triangles: number
}

interface WorldData {
}

interface BoundData {
}

const drawable: () => Drawable<ShaderCache, WorldData, BoundData> = () => ({
    onConfigModified(previous: ShaderCache | null) {
        return false
    },
    createShader: async function (allocator: GpuAllocator, previous: ShaderCache | null): Promise<ShaderCache> {
        const pig = foo()
        console.log(pig.shader);

        const options: Parameters<typeof vertexShaderSource>[0] = { modelTransformationsSource: pig.shader }
        const program = await allocator.newProgram<Attributes, Uniforms>({
            vertexSource: vertexShaderSource(options),
            fragmentSource: fragmentShaderSource(options),
        })

        const vao = allocator.newVao()
        const modelBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const indicesBuffer = allocator.newBuffer({ dynamic: false, forArray: false })

        program.use()
        vao.bind()
        modelBuffer.bind()
        indicesBuffer.bind()

        modelBuffer.setContent(new Float32Array([...pig.points]))

        program.useAttributes({
            'modelPosition': { count: 3, type: AttrType.Float },
            'modelExtra': { count: 1, type: AttrType.Float },
        })

        indicesBuffer.setContent(new Uint8Array([...pig.indices]))

        return {
            program,
            vao,
            triangles: pig.triangles,
        }
    },
    createWorld(params: LoadParams, previous: WorldData | null): WorldData {
        return {
        }
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
        const { gl, camera: { combinedMatrix } } = ctx
        const { program, vao, triangles } = shader

        program.use()
        gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)
        gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(combinedMatrix))
        vao.bind()

        // gl.disable(gl.CULL_FACE)
        gl.drawElements(gl.TRIANGLES, triangles, gl.UNSIGNED_BYTE, 0)
        gl.enable(gl.CULL_FACE)
        // vao.unbind()
    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    }
})

export default drawable