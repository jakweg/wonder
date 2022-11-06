import TypedArray from '@seampan/typed-array'
import EntityContainer from '../../../game-state/entities/entity-container'
import { iterateOverDrawableEntities } from '../../../game-state/entities/queries'
import { DataOffsetDrawables, DataOffsetPositions } from '../../../game-state/entities/traits'
import { GPUBuffer, VertexArray } from '../../gpu-resources'
import GlProgram, { AttrType } from '../../gpu-resources/program'
import ModelId, { getModelPrototype } from '../../model/model-id'
import { GpuAllocator } from '../../pipeline/allocator'
import { Drawable, LoadParams } from '../../pipeline/Drawable'
import { RenderContext, ShaderGlobals } from '../../render-context'
import ChunkVisibilityIndex from '../chunk-visibility'
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './shaders'

interface ModelPose {
  vao: VertexArray
  program: GlProgram<Attributes, never>
  triangles: number
  entityDataNumbersArray: number[]
  entitiesCount: number
  entityDataArray: TypedArray
  entityDataBuffer: GPUBuffer
}

interface ModelPrototype {
  poses: ModelPose[]
}

interface ShaderCache {
  models: ModelPrototype[]
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
        const proto = getModelPrototype(modelIndex)
        const poses = await Promise['all'](
          [...new Array(proto.posesCount)].map(async (_, poseIndex) => {
            const pose = proto.buildPose(poseIndex)

            const options: Parameters<typeof vertexShaderSource>[0] = {
              modelTransformationsSource: pose.modelTransformationShader,
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
              'entityRotationChangeTick': { count: 1, type: AttrType.UShort, divisor: 1 },
            })

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
              entityDataNumbersArray: [],
              triangles: pose.indices.length,
            } as ModelPose
          }),
        )

        return {
          poses,
        }
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
      for (const pose of model.poses) {
        pose.entityDataNumbersArray.length = pose.entitiesCount = 0
      }
    }

    const visibility = data.visibility
    const container = data.entities
    const positions = container.positions.rawData
    const drawables = container.drawables.rawData

    for (const record of iterateOverDrawableEntities(container)) {
      const unitX = positions[record.position + DataOffsetPositions.PositionX]!
      const unitZ = positions[record.position + DataOffsetPositions.PositionZ]!
      if (!visibility.isPointInViewport(unitX, unitZ)) continue
      const unitY = positions[record.position + DataOffsetPositions.PositionY]!

      const modelId = drawables[record.drawable + DataOffsetDrawables.ModelId]!
      const model = shader.models[modelId]
      if (model === undefined) {
        console.error({ modelId, drawables, copyLength: drawables.length, ...record })

        throw new Error()
      }

      const poseId = drawables[record.drawable + DataOffsetDrawables.PoseId]!
      const pose = model.poses[poseId]
      if (pose === undefined) throw new Error()

      const rotation = drawables[record.drawable + DataOffsetDrawables.Rotation]!
      const rotationChangeTick = drawables[record.drawable + DataOffsetDrawables.RotationChangeTick]!

      pose.entityDataNumbersArray.push(
        record.thisId,
        unitX,
        unitY,
        unitZ,
        0xffff,
        0xffff,
        0xffff, // color
        2, // size
        rotation,
        rotationChangeTick,
      )
      pose.entitiesCount++
    }
  },
  prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void {},
  uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    for (const model of shader.models) {
      for (const pose of model.poses) {
        if (pose.entitiesCount !== 0) {
          pose.entityDataArray = new Uint16Array(pose.entityDataNumbersArray)
          pose.entityDataBuffer.setContent(pose.entityDataArray)
        }
      }
    }
  },
  draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {
    const { gl, stats } = ctx
    const { models } = shader

    let drawCalls = 0
    for (const model of models) {
      for (const pose of model.poses) {
        if (pose.entitiesCount === 0) continue

        pose.vao.bind()
        pose.program.use()

        gl.drawElementsInstanced(gl.TRIANGLES, pose.triangles, gl.UNSIGNED_SHORT, 0, pose.entitiesCount)
        drawCalls++
      }
    }
    stats.incrementDrawCalls(drawCalls)
  },
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void {},
})

export default drawable
