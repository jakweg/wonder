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
        const modelDataBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const entityDataBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const entityColorsBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const indicesBuffer = allocator.newBuffer({ dynamic: false, forArray: false })

        program.use()
        vao.bind()

        indicesBuffer.setContent(pig.indices)


        modelDataBuffer.setContent(pig.vertexDataArray)
        program.useAttributes({
            'modelSideColor': { count: 3, type: AttrType.UByte, normalize: true, divisor: 0 },
            'modelNormal': { count: 1, type: AttrType.UByte, divisor: 0 },
            'modelFlags': { count: 1, type: AttrType.UByte, divisor: 0 },
        })

        const positions = [
            [1, 5, 2, 7],
            [2, 3, 2, 5],
            [3, 6, 2, 4],
        ].flat()

        entityDataBuffer.setContent(new Uint16Array(positions))
        program.useAttributes({
            'entityId': { count: 1, type: AttrType.UShort, divisor: 1 },
            'entityPosition': { count: 3, type: AttrType.UShort, divisor: 1 },
        })

        const colors = [
            [255, 50, 127,],
            [255, 0, 255,],
            [30, 233, 89,],
        ].flat()

        entityColorsBuffer.setContent(new Uint8Array(colors))
        program.useAttributes({
            'entityColor': { count: 3, type: AttrType.UByte, normalize: true, divisor: 1 },
        })


        modelBuffer.setContent(pig.vertexPoints)
        program.useAttributes({
            'modelPosition': { count: 3, type: AttrType.Float, divisor: 0 },
        })

        return {
            program,
            vao,
            triangles: pig.indices.length | 0,
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
        gl.drawElementsInstanced(gl.TRIANGLES, triangles, gl.UNSIGNED_SHORT, 0, 3)
        gl.enable(gl.CULL_FACE)
        // vao.unbind()
    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    }
})

export default drawable