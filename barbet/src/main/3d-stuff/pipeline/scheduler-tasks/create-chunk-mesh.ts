import { WORLD_CHUNK_SIZE } from '@game/world/world'
import { buildChunkMesh } from '@game/world/world-to-mesh-converter'
import { Environment } from '.'
import { Task, TaskResult, TaskType } from '../work-scheduler'

export default async (env: Environment, task: Task): Promise<TaskResult> => {
  if (task.type !== TaskType.CreateChunkMesh) throw new Error()

  const world = env.world
  const i = (task.chunkIndex / world.size.chunksSizeX) | 0
  const j = task.chunkIndex % world.size.chunksSizeX | 0

  env.mutexEnter()
  const recreationId = world.chunkModificationIds[task.chunkIndex]!
  const mesh = buildChunkMesh(world, i, j, WORLD_CHUNK_SIZE)
  env.mutexExit()

  return {
    type: TaskType.CreateChunkMesh,
    chunkIndex: task.chunkIndex,
    indicesBuffer: mesh.indices['buffer'] as SharedArrayBuffer,
    vertexBuffer: mesh.vertexes['buffer'] as SharedArrayBuffer,
    recreationId,
  }
}
