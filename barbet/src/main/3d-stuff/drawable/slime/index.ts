import { toGl } from '@matrix/common'
import SeededRandom from '@seampan/seeded-random'
import { GlProgram, GPUBuffer, VertexArray } from '../../gpu-resources'
import { AttrType } from '../../gpu-resources/program'
import constructSlime from '../../model/entity/slime'
import { GpuAllocator } from "../../pipeline/allocator"
import { Drawable, LoadParams } from "../../pipeline/Drawable"
import { RenderContext } from "../../render-context"
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './shaders'

interface Slime {
    id: number
    positionX: number
    positionY: number
    positionZ: number
    color: [number, number, number]
    size: number
    rotation: number
}

interface ShaderCache {
    program: GlProgram<Attributes, Uniforms>
    vao: VertexArray
    entityDataBuffer: GPUBuffer
    triangles: number
}

interface WorldData {
    slimes: Slime[]
}

interface BoundData {
}

const drawable: () => Drawable<ShaderCache, WorldData, BoundData> = () => ({
    onConfigModified(previous: ShaderCache | null) {
        return false
    },
    createShader: async function (allocator: GpuAllocator, previous: ShaderCache | null): Promise<ShaderCache> {
        const slime = constructSlime()
        console.log(slime.shader);

        const options: Parameters<typeof vertexShaderSource>[0] = { modelTransformationsSource: slime.shader }
        const program = await allocator.newProgram<Attributes, Uniforms>({
            vertexSource: vertexShaderSource(options),
            fragmentSource: fragmentShaderSource(options),
        })

        const vao = allocator.newVao()
        const modelBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const modelDataBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const entityDataBuffer = allocator.newBuffer({ dynamic: true, forArray: true })
        const indicesBuffer = allocator.newBuffer({ dynamic: false, forArray: false })

        program.use()
        vao.bind()

        indicesBuffer.setContent(slime.indices)


        modelDataBuffer.setContent(slime.vertexDataArray)
        program.useAttributes({
            'modelSideColor': { count: 3, type: AttrType.UByte, normalize: true, divisor: 0 },
            'modelNormal': { count: 1, type: AttrType.UByte, divisor: 0 },
            'modelFlags': { count: 1, type: AttrType.UByte, divisor: 0 },
        })

        entityDataBuffer.bind()
        program.useAttributes({
            'entityId': { count: 1, type: AttrType.UShort, divisor: 1 },
            'entityPosition': { count: 3, type: AttrType.UShort, divisor: 1 },
            'entityColor': { count: 3, type: AttrType.UShort, normalize: true, divisor: 1 },
            'entitySize': { count: 1, type: AttrType.UShort, divisor: 1 },
            'entityRotation': { count: 1, type: AttrType.UShort, divisor: 1 },
        })

        modelBuffer.setContent(slime.vertexPoints)
        program.useAttributes({
            'modelPosition': { count: 3, type: AttrType.Float, divisor: 0 },
        })

        return {
            program,
            vao,
            entityDataBuffer,
            triangles: slime.indices.length | 0,
        }
    },
    createWorld(params: LoadParams, previous: WorldData | null): WorldData {
        const random = SeededRandom.fromSeed(Date.now())
        const obj: WorldData = {
            slimes: [...new Array(10_000)].map((_, i) => (
                {
                    id: i + 1, size: random.nextInt(2) + Math.ceil(random.nextInt(2) / 2.0) + 1, rotation: random.nextInt(8),
                    positionX: random.nextInt(500) + 200, positionZ: random.nextInt(500) + 200,
                    positionY: 2, color: [random.nextInt(255 ** 2), random.nextInt(255 ** 2), random.nextInt(255 ** 2),],
                }
            )),
        }
        obj.slimes.forEach(s => s.positionY = params.game.world.getHighestBlockHeight(s.positionX, s.positionZ) + 1)
        return obj
    },
    async bindWorldData(allocator: GpuAllocator, shader: ShaderCache, data: WorldData, previous: BoundData): Promise<BoundData> {
        const asNumbers = data.slimes.flatMap(slime => [slime.id, slime.positionX, slime.positionY, slime.positionZ, ...slime.color, slime.size, slime.rotation]);
        shader.entityDataBuffer.setContent(new Uint16Array(asNumbers))
        return {}
    },
    updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    },
    prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {
    },
    uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    },
    draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
        const { gl, camera: { combinedMatrix }, stats } = ctx
        const { program, vao, triangles } = shader

        program.use()
        gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)
        gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(combinedMatrix))
        vao.bind()

        gl.drawElementsInstanced(gl.TRIANGLES, triangles, gl.UNSIGNED_SHORT, 0, world.slimes.length)
        stats.incrementDrawCalls(1)
    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    }
})

export default drawable