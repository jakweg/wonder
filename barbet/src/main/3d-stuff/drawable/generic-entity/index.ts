import { GlProgram, GPUBuffer, VertexArray } from '@3d/gpu-resources'
import { AttrType } from '@3d/gpu-resources/program'
import { getBuildModelCallback, ModelId } from '@3d/model/model-id'
import { GpuAllocator } from '@3d/pipeline/allocator'
import { Drawable, LoadParams } from '@3d/pipeline/Drawable'
import { RenderContext, ShaderGlobals } from '@3d/render-context'
import { DataOffsetDrawables, DataOffsetPositions } from '@game/entities/data-offsets'
import EntityContainer from '@game/entities/entity-container'
import { findAllDrawableEntities } from '@game/entities/queries/drawable'
import TypedArray from '@seampan/typed-array'
import ChunkVisibilityIndex from '../chunk-visibility'
import { Attributes, buildAttributeBundle, fragmentShaderSource, Uniforms, vertexShaderSource } from './shaders'

const POSITIONS_BYTES = 3 * 2
const INITIAL_RESERVE_INSTANCES_COUNT = 8

interface ModelPose {
  vao: VertexArray
  program: GlProgram<Attributes, never>
  triangles: number
  entitiesCount: number
  entityDataArray: TypedArray
  entityDataArrayUsedCount: number
  entityDataArrayReservedCount: number
  entityDataBuffer: GPUBuffer
  copyBytesCount: number
}

interface ShaderCache {
  models: ModelPose[]
}

interface WorldData {
  entities: EntityContainer
  visibility: ChunkVisibilityIndex
}

interface BoundData {}

const drawable: () => Drawable<ShaderGlobals, ShaderCache, WorldData, BoundData> = () => ({
  onConfigModified(previous: ShaderCache | null) {
    return false
  },
  createShader: async function (
    allocator: GpuAllocator,
    globals: ShaderGlobals,
    previous: ShaderCache | null,
  ): Promise<ShaderCache> {
    const prototypes = await Promise['all'](
      [...new Array(ModelId.SIZE)].map(async (_, modelIndex) => {
        const pose = getBuildModelCallback(modelIndex)()
        const options: Parameters<typeof vertexShaderSource>[0] = {
          modelTransformationsSource: pose.modelTransformationShader,
          entityAttributes: pose.entityAttributes,
          modelAttributes: pose.modelAttributes,
        }
        const promise = allocator
          .newProgram<Attributes, Uniforms>({
            vertexSource: vertexShaderSource(options),
            fragmentSource: fragmentShaderSource(options),
          })
          .then(globals.bindProgram)

        const vao = allocator.newVao()
        const entityDataBuffer = allocator.newBuffer({ dynamic: true, forArray: true })
        const modelBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const modelDataBuffer = allocator.newBuffer({ dynamic: false, forArray: true })
        const indicesBuffer = allocator.newBuffer({ dynamic: false, forArray: false })

        const program = await promise

        program.use()
        vao.bind()

        indicesBuffer.setContent(pose.indices)

        modelDataBuffer.setContent(pose.vertexDataArray)
        program.useAttributes(buildAttributeBundle(true, pose.modelAttributes))

        entityDataBuffer.bind()
        program.useAttributes(buildAttributeBundle(false, pose.entityAttributes))

        modelBuffer.setContent(pose.vertexPoints)
        program.useAttributes({
          'modelPosition': { count: 3, type: AttrType.Float, divisor: 0 },
        })

        return {
          vao,
          program,
          entityDataBuffer,
          entitiesCount: 0,
          entityDataArray: new Uint8Array(0),
          entityDataArrayReservedCount: 0,
          entityDataArrayUsedCount: 0,
          triangles: pose.indices.length,
          copyBytesCount: pose.copyBytesPerInstanceCount,
        } as ModelPose
      }),
    )

    return {
      models: prototypes,
    }
  },
  createWorld(params: LoadParams, previous: WorldData | null): WorldData {
    const entities = params.game.entities
    return { entities, visibility: params.visibility }
  },
  async bindWorldData(
    allocator: GpuAllocator,
    shader: ShaderCache,
    data: WorldData,
    previous: BoundData,
  ): Promise<BoundData> {
    return {}
  },
  updateWorld(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    for (const model of shader.models) {
      model.entityDataArrayUsedCount = model.entitiesCount = 0
    }

    const visibility = data.visibility
    const container = data.entities
    const positions = container.positions.rawData
    const drawables = container.drawables.rawData

    findAllDrawableEntities(container, record => {
      const positionStart = record.position
      const unitX = positions[positionStart + DataOffsetPositions.PositionX]! | 0
      const unitZ = positions[positionStart + DataOffsetPositions.PositionZ]! | 0
      if (!visibility.isPointInViewport(unitX, unitZ)) return
      const unitY = positions[positionStart + DataOffsetPositions.PositionY]! | 0

      const drawableStart = record.drawable
      const modelId = drawables[drawableStart + DataOffsetDrawables.ModelId]! | 0
      const model = shader.models[modelId]
      if (model === undefined) throw new Error()

      if (model.entityDataArrayReservedCount === model.entityDataArrayUsedCount) {
        // the buffer needs resizing
        const old = model.entityDataArray
        model.entityDataArrayReservedCount = (model.entityDataArrayReservedCount || INITIAL_RESERVE_INSTANCES_COUNT) * 2
        const newBuffer = (model.entityDataArray = new Uint8Array(
          model.entityDataArrayReservedCount * (model.copyBytesCount + POSITIONS_BYTES),
        ))
        let i = 0
        for (const v of old) newBuffer[i++] = v
      }
      let index = model.entityDataArrayUsedCount++ * (model.copyBytesCount + POSITIONS_BYTES)
      const array = model.entityDataArray
      array[index++] = (unitX >> 0) & 0xff
      array[index++] = (unitX >> 8) & 0xff
      array[index++] = (unitY >> 0) & 0xff
      array[index++] = (unitY >> 8) & 0xff
      array[index++] = (unitZ >> 0) & 0xff
      array[index++] = (unitZ >> 8) & 0xff

      for (let i = 0, l = model.copyBytesCount; i < l; ++i) {
        array[index++] = drawables[drawableStart + i]! | 0
      }
      model.entitiesCount++
    })
  },
  prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {},
  uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    for (const model of shader.models) {
      if (model.entitiesCount !== 0) {
        model.entityDataBuffer.setPartialContent(
          model.entityDataArray,
          0,
          model.entityDataArrayUsedCount * (model.copyBytesCount + POSITIONS_BYTES),
        )
      }
    }
  },
  draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    const { gl, stats } = ctx
    const { models } = shader

    let drawCalls = 0
    for (const model of models) {
      if (model.entitiesCount === 0) continue

      model.vao.bind()
      model.program.use()

      gl.drawElementsInstanced(gl.TRIANGLES, model.triangles, gl.UNSIGNED_SHORT, 0, model.entitiesCount)
      drawCalls++
    }
    stats.incrementDrawCalls(drawCalls)
  },
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {},
})

export default drawable
