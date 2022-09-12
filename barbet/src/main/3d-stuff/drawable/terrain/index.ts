import { toGl } from "@matrix/common"
import { GameState, MetadataField } from "../../../game-state/game-state"
import { WORLD_CHUNK_SIZE } from "../../../game-state/world/world"
import { buildChunkMesh, Mesh } from "../../../game-state/world/world-to-mesh-converter"
import CONFIG from "../../../util/persistance/observable-settings"
import { pickViaMouseDefaultFragmentShader } from "../../common-shader"
import { GlProgram, GPUBuffer, VertexArray } from "../../gpu-resources"
import { GpuAllocator } from "../../pipeline/allocator"
import { Drawable } from "../../pipeline/Drawable"
import { RenderContext } from "../../renderable/render-context"
import { Attributes, fragmentShaderSource, MousePickerAttributes, MousePickerUniforms, Uniforms, vertexShaderSource } from "../../renderable/terrain/shaders"


interface ShaderCache {
    hasAmbient: boolean
    hasTiles: boolean
    program: GlProgram<Attributes, Uniforms>
    mouseProgram: GlProgram<MousePickerAttributes, MousePickerUniforms>
    lastMeshUploadId: number
    chunks: ChunkDataShader[] | null
}

interface WorldData {
    game: GameState
    chunks: ChunkDataGame[]
    lastMeshRecreationId: number
    meshes: Mesh[]
    lastMeshModificationIds: Uint16Array
    trianglesToRender: number
}

interface BoundData {
}

interface ChunkDataGame {
    vertexes: Float32Array
    indices: Uint32Array
    triangles: number
    lastRecreationId: number
}
interface ChunkDataShader {
    vertexes: GPUBuffer
    indices: GPUBuffer
    triangles: number
    vao: VertexArray
    mouseVao: VertexArray
    lastUploadId: number
}

const floatSize = Float32Array.BYTES_PER_ELEMENT
const stride = 8 * floatSize

const drawable: () => Drawable<ShaderCache, WorldData, BoundData> = () => ({
    onConfigModified(previous: ShaderCache | null) {
        return previous === null
            || CONFIG.get('rendering/ambient-occlusion') !== previous.hasAmbient
            || CONFIG.get('rendering/show-tile-borders') !== previous.hasTiles
    },
    createShader: async function (allocator: GpuAllocator, previous: ShaderCache | null): Promise<ShaderCache> {
        const options = {
            ambientOcclusion: CONFIG.get('rendering/ambient-occlusion'),
            tileBorders: CONFIG.get('rendering/show-tile-borders'),
            forMousePicker: false
        }
        const shader = allocator.newProgram<Attributes, Uniforms>({
            vertexSource: vertexShaderSource(options),
            fragmentSource: fragmentShaderSource(options)
        })

        const mouseShader = previous?.mouseProgram ?? allocator.newProgram<MousePickerAttributes, MousePickerUniforms>({
            vertexSource: vertexShaderSource({ ...options, forMousePicker: true }),
            fragmentSource: pickViaMouseDefaultFragmentShader(),
        })

        const program = await shader

        program.use()

        const mouseProgram = await mouseShader

        return {
            program, mouseProgram,
            hasAmbient: options.ambientOcclusion,
            hasTiles: options.tileBorders,
            lastMeshUploadId: previous?.lastMeshUploadId ?? -2,
            chunks: previous?.chunks ?? null
        }
    },
    createWorld(game: GameState, previous: WorldData | null): WorldData {
        const world = game.world
        const chunksX = world.size.chunksSizeX
        const chunksZ = world.size.chunksSizeZ

        const chunks: ChunkDataGame[] = []
        for (let i = 0; i < chunksX; ++i)
            for (let j = 0; j < chunksZ; ++j)
                chunks.push({
                    vertexes: new Float32Array(),
                    indices: new Uint32Array(),
                    triangles: 0,
                    lastRecreationId: -1,
                })

        const meshes: Mesh[] = new Array(chunksX * chunksZ)
        const lastMeshModificationIds: Uint16Array = new Uint16Array(chunksX * chunksZ)
        lastMeshModificationIds.fill(-1)

        return {
            chunks,
            game,
            meshes,
            lastMeshModificationIds,
            trianglesToRender: 0,
            lastMeshRecreationId: -1,
        }
    },
    async bindWorldData(allocator: GpuAllocator, shader: ShaderCache, data: WorldData, previous: BoundData): Promise<BoundData> {
        if (shader.chunks === null) {
            const chunks = shader.chunks = data.chunks.map(() => ({
                vertexes: allocator.newBuffer({ dynamic: false, forArray: true }),
                indices: allocator.newBuffer({ dynamic: false, forArray: false }),
                vao: allocator.newVao(),
                mouseVao: allocator.newVao(),
                triangles: 0,
                lastUploadId: -2,
            }))

            const { program, mouseProgram } = shader
            for (const c of chunks) {
                program.use()
                c.vao.bind()
                c.vertexes.bind()
                c.indices.bind()

                program.enableAttribute(program.attributes['position'], 3, true, stride, 0, 0)
                program.enableAttribute(program.attributes['color'], 3, true, stride, 3 * floatSize, 0)
                program.enableAttribute(program.attributes['flags'], 1, true, stride, 6 * floatSize, 0)
                program.enableAttribute(program.attributes['ambientOcclusion'], 1, true, stride, 7 * floatSize, 0)
                c.vao.unbind()

                mouseProgram.use()
                c.mouseVao.bind()
                c.vertexes.bind()
                mouseProgram.enableAttribute(mouseProgram.attributes['position'], 3, true, stride, 0, 0)
                mouseProgram.enableAttribute(mouseProgram.attributes['flags'], 1, true, stride, 6 * floatSize, 0)
                c.indices.bind()
                c.mouseVao.unbind()
            }
        }

        return {}
    },
    updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {
        const lastChangeId = data.game.metaData[MetadataField.LastWorldChange]!
        if (data.lastMeshRecreationId === lastChangeId) return
        data.lastMeshRecreationId = lastChangeId

        const dataChunks = data.chunks!
        const modificationIds = data.game.world.chunkModificationIds

        const chunksZ = data.game.world.size.chunksSizeZ
        const chunksX = data.game.world.size.chunksSizeX
        let chunkIndex = 0
        for (let i = 0; i < chunksX; i++) {
            for (let j = 0; j < chunksZ; j++) {

                const modificationId = modificationIds[chunkIndex]!
                const chunkData = dataChunks[chunkIndex]!
                if (chunkData.lastRecreationId !== modificationId) {
                    chunkData.lastRecreationId = modificationId

                    const mesh = buildChunkMesh(data.game.world, i, j, WORLD_CHUNK_SIZE)
                    chunkData.indices = mesh.indices
                    chunkData.vertexes = mesh.vertexes
                    chunkData.triangles = mesh.indices.length
                }
                chunkIndex++
            }
        }

    },
    prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {
    },
    uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {
        if (shader.lastMeshUploadId === data.lastMeshRecreationId) return
        shader.lastMeshUploadId = data.lastMeshRecreationId


        const dataChunks = data.chunks!
        const shaderChunks = shader.chunks!

        const chunksZ = data.game.world.size.chunksSizeZ
        const chunksX = data.game.world.size.chunksSizeX
        let chunkIndex = 0
        for (let i = 0; i < chunksX; i++) {
            for (let j = 0; j < chunksZ; j++) {

                const chunkData = dataChunks[chunkIndex]!
                const shaderChunkData = shaderChunks[chunkIndex]!
                if (shaderChunkData.lastUploadId !== chunkData.lastRecreationId) {
                    shaderChunkData.lastUploadId = chunkData.lastRecreationId

                    shaderChunkData.vertexes.setContent(chunkData.vertexes)
                    shaderChunkData.indices.setContent(chunkData.indices)
                    shaderChunkData.triangles = chunkData.triangles
                }
                chunkIndex++
            }
        }
    },
    draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {

        const { gl, camera } = ctx
        const { program } = shader
        program.use()

        gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(camera.combinedMatrix))
        gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)
        gl.uniform3fv(program.uniforms['lightPosition'], toGl(ctx.sunPosition))

        for (const chunk of shader.chunks!) {
            if (chunk.triangles === 0)
                continue

            chunk.vao.bind()
            gl.drawElements(gl.TRIANGLES, chunk.triangles, gl.UNSIGNED_INT, 0)
        }

    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {

        const { gl, camera } = ctx
        const { mouseProgram: program } = shader
        program.use()

        gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(camera.combinedMatrix))
        gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)

        for (const chunk of shader.chunks!) {
            if (chunk.triangles === 0)
                continue

            chunk.mouseVao.bind()
            gl.drawElements(gl.TRIANGLES, chunk.triangles, gl.UNSIGNED_INT, 0)
        }
    }
})

export default drawable