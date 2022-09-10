import { toGl } from "@matrix/common"
import { GameState, MetadataField } from "../../../game-state/game-state"
import { WORLD_CHUNK_SIZE } from "../../../game-state/world/world"
import { buildChunkMesh, combineMeshes, Mesh } from "../../../game-state/world/world-to-mesh-converter"
import CONFIG from "../../../util/persistance/observable-settings"
import { GlProgram, GPUBuffer, VertexArray } from "../../main-renderer"
import { GpuAllocator } from "../../pipeline/allocator"
import { Drawable } from "../../pipeline/Drawable"
import { RenderContext } from "../../renderable/render-context"
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from "../../renderable/terrain/shaders"


interface ShaderCache {
    program: GlProgram<Attributes, Uniforms>
    vao: VertexArray
    vertexBuffer: GPUBuffer
    indicesBuffer: GPUBuffer
}

interface WorldData {
    game: GameState
}

interface BoundData {
    trianglesToRender: number
    lastMeshRecreationId: number
    meshes: Mesh[]
    lastMeshModificationIds: Uint16Array
}

const floatSize = Float32Array.BYTES_PER_ELEMENT
const stride = 8 * floatSize

const drawable: () => Drawable<ShaderCache, WorldData, BoundData> = () => ({
    createShader: async function (allocator: GpuAllocator, previous: ShaderCache | null): Promise<ShaderCache> {
        const options = {
            ambientOcclusion: CONFIG.get('rendering/ambient-occlusion'),
            tileBorders: CONFIG.get('rendering/show-tile-borders'),
            forMousePicker: false
        }
        const vertexSource = vertexShaderSource(options)
        const fragmentSource = fragmentShaderSource(options)
        const shader = allocator.newProgram<Attributes, Uniforms>({ vertexSource, fragmentSource })

        const vao = allocator.newVao()

        const vertexBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const indicesBuffer = allocator.newBuffer({ dynamic: false, forArray: false })

        const program = await shader

        vao.bind()
        program.use()
        vertexBuffer.bind()
        indicesBuffer.bind()

        program.enableAttribute(program.attributes['position'], 3, true, stride, 0, 0)
        program.enableAttribute(program.attributes['color'], 3, true, stride, 3 * floatSize, 0)
        program.enableAttribute(program.attributes['flags'], 1, true, stride, 6 * floatSize, 0)
        program.enableAttribute(program.attributes['ambientOcclusion'], 1, true, stride, 7 * floatSize, 0)

        vao.unbind()
        return { program, vao, vertexBuffer, indicesBuffer }
    },
    createWorld(game: GameState, previous: WorldData | null): WorldData {
        return { game }
    },
    bindWorldData(allocator: GpuAllocator, shader: ShaderCache, data: WorldData): BoundData {

        const world = data.game.world
        const chunksX = world.size.chunksSizeX
        const chunksZ = world.size.chunksSizeZ
        const meshes: Mesh[] = new Array(chunksX * chunksZ)
        const lastMeshModificationIds: Uint16Array = new Uint16Array(chunksX * chunksZ)
        lastMeshModificationIds.fill(-1)

        return {
            trianglesToRender: 0,
            lastMeshRecreationId: -1,
            meshes,
            lastMeshModificationIds,
        }
    },
    updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {
        const lastChangeId = data.game.metaData[MetadataField.LastWorldChange]!
        if (bound.lastMeshRecreationId === lastChangeId) return
        bound.lastMeshRecreationId = lastChangeId


        const chunksZ = data.game.world.size.chunksSizeZ
        const chunksX = data.game.world.size.chunksSizeX
        let chunkIndex = 0
        for (let j = 0; j < chunksZ; j++) {
            for (let i = 0; i < chunksX; i++) {
                const modificationId = data.game.world.chunkModificationIds[chunkIndex]!
                if (bound.lastMeshModificationIds[chunkIndex] !== modificationId) {
                    bound.lastMeshModificationIds[chunkIndex] = modificationId
                    bound.meshes[chunkIndex] = buildChunkMesh(data.game.world, i, j, WORLD_CHUNK_SIZE)
                }
                chunkIndex++
            }
        }

        const combinedMesh: Mesh = combineMeshes(bound.meshes)
        console.log(combinedMesh);

        shader.vertexBuffer.setContent(combinedMesh.vertexes)
        shader.indicesBuffer.setContent(combinedMesh.indices)
        bound.trianglesToRender = (combinedMesh.indices.byteLength / combinedMesh.indices.BYTES_PER_ELEMENT) | 0
        bound.lastMeshRecreationId = lastChangeId
    },
    prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {

    },
    uploadToGpu(shader: ShaderCache, world: WorldData, bound: BoundData): void {

    },
    draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {

        const { gl, camera } = ctx
        const { program, vao } = shader
        vao.bind()
        program.use()

        gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(camera.combinedMatrix))
        gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)
        gl.uniform3fv(program.uniforms['lightPosition'], toGl(ctx.sunPosition))

        gl.drawElements(gl.TRIANGLES, bound.trianglesToRender, gl.UNSIGNED_INT, 0)
    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
        throw new Error("Function not implemented.")
    }
})

export default drawable