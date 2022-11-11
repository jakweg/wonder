import { GlProgram, GPUBuffer, VertexArray } from '@3d/gpu-resources'
import { AttrType } from '@3d/gpu-resources/program'
import { getAttrTypeByType, getCountByType, shouldNormalize } from '@3d/model/builder/model-attribute-type'
import ModelId, { getModelPrototype } from '@3d/model/model-id'
import { GpuAllocator } from '@3d/pipeline/allocator'
import { Drawable, LoadParams } from '@3d/pipeline/Drawable'
import { RenderContext, ShaderGlobals } from '@3d/render-context'
import { DataOffsetDrawables, DataOffsetPositions } from "@game/entities/data-offsets"
import EntityContainer from '@game/entities/entity-container'
import { iterateOverDrawableEntities } from '@game/entities/queries'
import TypedArray from '@seampan/typed-array'
import ChunkVisibilityIndex from '../chunk-visibility'
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './shaders'

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

interface BoundData { }

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
              attributes: pose.attributes,
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


            program.useAttributes(Object.fromEntries(Object
              .entries(pose.attributes)
              .map(([key, type]) => ['entity' + key, {
                count: getCountByType(type),
                type: getAttrTypeByType(type),
                normalize: shouldNormalize(type) || undefined,
                divisor: 1
              }])))

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
        pose.entityDataArrayUsedCount = pose.entitiesCount = 0
      }
    }

    const visibility = data.visibility
    const container = data.entities
    const positions = container.positions.rawData
    const drawables = container.drawables.rawData

    for (const record of iterateOverDrawableEntities(container)) {
      const positionStart = record.position
      const unitX = positions[positionStart + DataOffsetPositions.PositionX]! | 0
      const unitZ = positions[positionStart + DataOffsetPositions.PositionZ]! | 0
      if (!visibility.isPointInViewport(unitX, unitZ)) continue
      const unitY = positions[positionStart + DataOffsetPositions.PositionY]! | 0

      const drawableStart = record.drawable
      const modelId = drawables[drawableStart + DataOffsetDrawables.ModelId]! | 0
      const model = shader.models[modelId]
      if (model === undefined) throw new Error()

      const poseId = drawables[drawableStart + DataOffsetDrawables.PoseId]! | 0
      const pose = model.poses[poseId]
      if (pose === undefined) throw new Error()

      if (pose.entityDataArrayReservedCount === pose.entityDataArrayUsedCount) {
        // the buffer needs resizing
        const old = pose.entityDataArray
        pose.entityDataArrayReservedCount = (pose.entityDataArrayReservedCount || 16) * 2
        const newBuffer = pose.entityDataArray = new Uint8Array(pose.entityDataArrayReservedCount * (pose.copyBytesCount + 6)) // +6 for position
        let i = 0
        for (const v of old) newBuffer[i++] = v
      }
      let index = pose.entityDataArrayUsedCount++ * (pose.copyBytesCount + 6) //+6 for position
      const array = pose.entityDataArray
      array[index++] = (unitX >> 0) & 0xFF
      array[index++] = (unitX >> 8) & 0xFF
      array[index++] = (unitY >> 0) & 0xFF
      array[index++] = (unitY >> 8) & 0xFF
      array[index++] = (unitZ >> 0) & 0xFF
      array[index++] = (unitZ >> 8) & 0xFF


      for (let i = 0, l = pose.copyBytesCount; i < l; ++i) {
        array[index++] = drawables[drawableStart + i]! | 0
      }
      pose.entitiesCount++
    }
  },
  prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void { },
  uploadToGpu(shader: ShaderCache, data: WorldData, bound: BoundData): void {
    for (const model of shader.models) {
      for (const pose of model.poses) {
        if (pose.entitiesCount !== 0) {
          pose.entityDataBuffer.setPartialContent(pose.entityDataArray, 0, pose.entityDataArrayUsedCount * (pose.copyBytesCount + 6)) //+6 for position
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
  drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void { },
})

export default drawable
