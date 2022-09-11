import { toGl } from "@matrix/common"
import { GameState, MetadataField } from "../../../game-state/game-state"
import { WORLD_CHUNK_SIZE } from "../../../game-state/world/world"
import { buildChunkMesh, combineMeshes, Mesh } from "../../../game-state/world/world-to-mesh-converter"
import CONFIG from "../../../util/persistance/observable-settings"
import { pickViaMouseDefaultFragmentShader } from "../../common-shader"
import GPUBuffer from "../../gpu-resources/buffer"
import GlProgram from "../../gpu-resources/program"
import VertexArray from "../../gpu-resources/vao"
import { GpuAllocator } from "../../pipeline/allocator"
import { Drawable } from "../../pipeline/Drawable"
import { RenderContext } from "../../renderable/render-context"
import { Attributes, fragmentShaderSource, MousePickerAttributes, MousePickerUniforms, Uniforms, vertexShaderSource } from "../../renderable/terrain/shaders"


interface ShaderCache {
    hasAmbient: boolean
    hasTiles: boolean
    program: GlProgram<Attributes, Uniforms>
    mouseProgram: GlProgram<MousePickerAttributes, MousePickerUniforms>
    vao: VertexArray
    mouseVao: VertexArray
    vertexBuffer: GPUBuffer
    indicesBuffer: GPUBuffer
    lastMeshUploadId: number
}

interface WorldData {
    game: GameState
    lastMeshRecreationId: number
    meshes: Mesh[]
    lastMeshModificationIds: Uint16Array
    trianglesToRender: number
}

interface BoundData {
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

        const vao = previous?.vao ?? allocator.newVao()
        const mouseVao = previous?.mouseVao ?? allocator.newVao()

        const vertexBuffer = previous?.vertexBuffer ?? allocator.newBuffer({ dynamic: false, forArray: true })
        const indicesBuffer = previous?.indicesBuffer ?? allocator.newBuffer({ dynamic: false, forArray: false })

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

        const mouseProgram = await mouseShader

        mouseVao.bind()
        vertexBuffer.bind()
        mouseProgram.enableAttribute(mouseProgram.attributes['position'], 3, true, stride, 0, 0)
        mouseProgram.enableAttribute(mouseProgram.attributes['flags'], 1, true, stride, 6 * floatSize, 0)
        indicesBuffer.bind()
        mouseVao.unbind()

        return {
            program, vao, vertexBuffer, indicesBuffer, mouseProgram, mouseVao,
            hasAmbient: options.ambientOcclusion, hasTiles: options.tileBorders,
            lastMeshUploadId: previous?.lastMeshUploadId ?? -2,
        }
    },
    createWorld(game: GameState, previous: WorldData | null): WorldData {
        const world = game.world
        const chunksX = world.size.chunksSizeX
        const chunksZ = world.size.chunksSizeZ
        const meshes: Mesh[] = new Array(chunksX * chunksZ)
        const lastMeshModificationIds: Uint16Array = new Uint16Array(chunksX * chunksZ)
        lastMeshModificationIds.fill(-1)

        return {
            game,
            meshes,
            lastMeshModificationIds,
            trianglesToRender: 0,
            lastMeshRecreationId: -1,
        }
    },
    bindWorldData(allocator: GpuAllocator, shader: ShaderCache, data: WorldData, previous: BoundData): BoundData {
        return {}
    },
    updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {
        const lastChangeId = data.game.metaData[MetadataField.LastWorldChange]!
        if (data.lastMeshRecreationId === lastChangeId) return
        data.lastMeshRecreationId = lastChangeId


        const chunksZ = data.game.world.size.chunksSizeZ
        const chunksX = data.game.world.size.chunksSizeX
        let chunkIndex = 0
        for (let j = 0; j < chunksZ; j++) {
            for (let i = 0; i < chunksX; i++) {
                const modificationId = data.game.world.chunkModificationIds[chunkIndex]!
                if (data.lastMeshModificationIds[chunkIndex] !== modificationId) {
                    data.lastMeshModificationIds[chunkIndex] = modificationId
                    data.meshes[chunkIndex] = buildChunkMesh(data.game.world, i, j, WORLD_CHUNK_SIZE)
                }
                chunkIndex++
            }
        }

        data.lastMeshRecreationId = lastChangeId
    },
    prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {

    },
    uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {
        if (shader.lastMeshUploadId === data.lastMeshRecreationId) return

        const combinedMesh: Mesh = combineMeshes(data.meshes)
        shader.vertexBuffer.setContent(combinedMesh.vertexes)
        shader.indicesBuffer.setContent(combinedMesh.indices)
        data.trianglesToRender = (combinedMesh.indices.byteLength / combinedMesh.indices.BYTES_PER_ELEMENT) | 0
        shader.lastMeshUploadId = data.lastMeshRecreationId
    },
    draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {

        const { gl, camera } = ctx
        const { program, vao } = shader
        vao.bind()
        program.use()

        gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(camera.combinedMatrix))
        gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)
        gl.uniform3fv(program.uniforms['lightPosition'], toGl(ctx.sunPosition))

        gl.drawElements(gl.TRIANGLES, world.trianglesToRender, gl.UNSIGNED_INT, 0)
    },
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {

        const { gl, camera } = ctx
        const { mouseProgram: program, mouseVao: vao } = shader
        vao.bind()
        program.use()

        gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(camera.combinedMatrix))
        gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)

        gl.drawElements(gl.TRIANGLES, world.trianglesToRender, gl.UNSIGNED_INT, 0)
    }
})

export default drawable