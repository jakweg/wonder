import { GameState, MetadataField } from "../../../game-state/game-state"
import { WORLD_CHUNK_SIZE } from "../../../game-state/world/world"
import CONFIG from "../../../util/persistance/observable-settings"
import { pickViaMouseDefaultFragmentShader } from "../../common-shader"
import { GlProgram, GPUBuffer, VertexArray } from "../../gpu-resources"
import { AttrType } from "../../gpu-resources/program"
import { GpuAllocator } from "../../pipeline/allocator"
import { Drawable, LoadParams } from "../../pipeline/Drawable"
import RenderHelperWorkScheduler, { TaskType } from "../../pipeline/work-scheduler"
import { RenderContext, ShaderGlobals } from "../../render-context"
import { Attributes, fragmentShaderSource, MousePickerAttributes, MousePickerUniforms, Uniforms, vertexShaderSource } from "./shaders"


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
    scheduler: RenderHelperWorkScheduler
    chunks: ChunkDataGame[]
    lastMeshRecreationId: number
    lastMeshModificationIds: Uint16Array
    trianglesToRender: number
}

interface BoundData {
}

interface ChunkDataGame {
    positionX: number
    positionZ: number
    vertexes: Uint8Array
    indices: Uint16Array
    triangles: number
    scheduledToRebuild: boolean
    lastRecreationId: number
}
interface ChunkDataShader {
    positionX: number
    positionZ: number
    vertexes: GPUBuffer
    indices: GPUBuffer
    triangles: number
    vao: VertexArray
    mouseVao: VertexArray
    lastUploadId: number
    visible: boolean
    wasBuilt: boolean
}


const drawable: () => Drawable<ShaderGlobals, ShaderCache, WorldData, BoundData> = () => ({
    onConfigModified(previous: ShaderCache | null) {
        return previous === null
            || CONFIG.get('rendering/ambient-occlusion') !== previous.hasAmbient
            || CONFIG.get('rendering/show-tile-borders') !== previous.hasTiles
    },
    createShader: async function (allocator: GpuAllocator, globals: ShaderGlobals, previous: ShaderCache | null): Promise<ShaderCache> {
        const options = {
            ambientOcclusion: CONFIG.get('rendering/ambient-occlusion'),
            tileBorders: CONFIG.get('rendering/show-tile-borders'),
            forMousePicker: false
        }
        const shader = allocator.newProgram<Attributes, Uniforms>({
            vertexSource: vertexShaderSource(options),
            fragmentSource: fragmentShaderSource(options)
        }).then(globals.bindProgram)

        const mouseShader = previous?.mouseProgram ?? allocator.newProgram<MousePickerAttributes, MousePickerUniforms>({
            vertexSource: vertexShaderSource({ ...options, forMousePicker: true }),
            fragmentSource: pickViaMouseDefaultFragmentShader(),
        }).then(globals.bindProgram)

        return {
            program: await shader,
            mouseProgram: await mouseShader,
            hasAmbient: options.ambientOcclusion,
            hasTiles: options.tileBorders,
            lastMeshUploadId: previous?.lastMeshUploadId ?? -2,
            chunks: previous?.chunks ?? null
        }
    },
    createWorld(params: LoadParams, previous: WorldData | null): WorldData {
        const { game, scheduler } = params
        const world = game.world
        const chunksX = world.size.chunksSizeX
        const chunksZ = world.size.chunksSizeZ

        const chunks: ChunkDataGame[] = []
        for (let i = 0; i < chunksX; ++i)
            for (let j = 0; j < chunksZ; ++j)
                chunks.push({
                    vertexes: new Uint8Array(),
                    indices: new Uint16Array(),
                    scheduledToRebuild: false,
                    triangles: 0,
                    lastRecreationId: -1,
                    positionX: i * WORLD_CHUNK_SIZE,
                    positionZ: j * WORLD_CHUNK_SIZE,
                })

        const lastMeshModificationIds: Uint16Array = new Uint16Array(chunksX * chunksZ)
        lastMeshModificationIds.fill(-1)

        return {
            chunks,
            game,
            scheduler,
            lastMeshModificationIds,
            trianglesToRender: 0,
            lastMeshRecreationId: -1,
        }
    },
    async bindWorldData(allocator: GpuAllocator, shader: ShaderCache, data: WorldData, previous: BoundData): Promise<BoundData> {
        if (shader.chunks === null) {
            shader.chunks = data.chunks.map((c) => ({
                vertexes: allocator.newBuffer({ dynamic: false, forArray: true }),
                indices: allocator.newBuffer({ dynamic: false, forArray: false }),
                vao: allocator.newVao(),
                mouseVao: allocator.newVao(),
                triangles: 0,
                lastUploadId: -1,
                positionX: c.positionX,
                positionZ: c.positionZ,
                visible: false,
                wasBuilt: false,
            }))
        }


        const { program, mouseProgram } = shader

        const attributesSet: Parameters<typeof program.useAttributes>[0] = {
            'position': { count: 3, type: AttrType.UByte, normalize: false },
            'offsets': { count: 1, type: AttrType.UByte },
            'color': { count: 3, type: AttrType.UByte, normalize: true },
            'flags': { count: 1, type: AttrType.UByte },
            'ambientOcclusion': { count: 1, type: AttrType.UShort }
        }

        for (const c of shader.chunks!) {
            c.vao.bind()
            c.vertexes.bind()
            c.indices.bind()
            program.useAttributes(attributesSet)

            c.mouseVao.bind()
            c.vertexes.bind()
            c.indices.bind()
            mouseProgram.useAttributes(attributesSet)
        }

        return {}
    },
    updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {
        const lastChangeId = data.game.metaData[MetadataField.LastWorldChange]!
        if (data.lastMeshRecreationId === lastChangeId) return
        data.lastMeshRecreationId = lastChangeId

        const dataChunks = data.chunks!
        const shaderChunks = shader.chunks!
        const modificationIds = data.game.world.chunkModificationIds

        const chunksZ = data.game.world.size.chunksSizeZ
        const chunksX = data.game.world.size.chunksSizeX
        let chunkIndex = 0

        for (let i = 0; i < chunksX; i++) {
            for (let j = 0; j < chunksZ; j++) {
                const shaderChunk = shaderChunks[chunkIndex]!
                if (shaderChunk.visible) {
                    const chunkData = dataChunks[chunkIndex]!
                    if (!chunkData.scheduledToRebuild) {
                        const modificationId = modificationIds[chunkIndex]!
                        if (chunkData.lastRecreationId !== modificationId) {
                            chunkData.scheduledToRebuild = true
                            data.scheduler.scheduleTask({
                                type: TaskType.CreateChunkMesh,
                                chunkIndex,
                            }).then(result => {
                                chunkData.indices = new Uint16Array(result.indicesBuffer)
                                chunkData.vertexes = new Uint8Array(result.vertexBuffer)
                                chunkData.triangles = chunkData.indices.length
                                chunkData.scheduledToRebuild = false
                                chunkData.lastRecreationId = result.recreationId
                                shader.lastMeshUploadId = -1
                            })
                        }
                    }
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

                    shaderChunkData.vao.bind()
                    shaderChunkData.vertexes.setContent(chunkData.vertexes)
                    shaderChunkData.indices.setContent(chunkData.indices)
                    shaderChunkData.triangles = chunkData.triangles
                    shaderChunkData.wasBuilt = true
                }
                chunkIndex++
            }
        }
    },
    draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {

        const { gl, visibility, stats } = ctx
        const { program } = shader
        program.use()

        const chunkPosition = program.uniforms['chunkPosition']
        let chunkIndex = 0
        let drawCalls = 0
        for (const chunk of shader.chunks!) {
            if (visibility.isChunkIndexVisible(chunkIndex)) {
                chunk.visible = true
                if (chunk.wasBuilt) {
                    if (chunk.triangles !== 0) {
                        chunk.vao.bind()
                        gl.uniform2f(chunkPosition, chunk.positionX, chunk.positionZ)

                        gl.drawElements(gl.TRIANGLES, chunk.triangles, gl.UNSIGNED_SHORT, 0)
                        drawCalls++
                    }
                } else {
                    // trigger rebuild need
                    world.lastMeshRecreationId = -1
                }
            } else {
                chunk.visible = false
            }

            chunkIndex++
        }
        gl.bindVertexArray(null)
        stats.incrementDrawCalls(drawCalls)

    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {

        const { gl, visibility } = ctx
        const { mouseProgram: program } = shader
        program.use()

        const chunkPosition = program.uniforms['chunkPosition']
        let chunkIndex = 0
        for (const chunk of shader.chunks!) {
            if (chunk.triangles !== 0 && visibility.isChunkIndexVisible(chunkIndex)) {
                chunk.mouseVao.bind()
                gl.uniform2f(chunkPosition, chunk.positionX, chunk.positionZ)

                gl.drawElements(gl.TRIANGLES, chunk.triangles, gl.UNSIGNED_SHORT, 0)
            }
            chunkIndex++
        }
        gl.bindVertexArray(null)
    }
})

export default drawable