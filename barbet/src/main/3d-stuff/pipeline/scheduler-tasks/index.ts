import createChunk2dMesh from '@3d/pipeline/scheduler-tasks/create-chunk-2d-mesh'
import { World } from '@game/world/world'
import { Task, TaskResult, TaskType } from '../work-scheduler'
import createChunkMesh from './create-chunk-mesh'

export interface Environment {
  world: World
  mutexEnter: () => void
  mutexExit: () => void
}

export const dispatch = (env: Environment, task: Task): Promise<TaskResult> => {
  switch (task.type) {
    case TaskType.CreateChunkMesh:
      return createChunkMesh(env, task)
    case TaskType.Create2dChunkMesh:
      return createChunk2dMesh(env, task)
    default:
      throw new Error()
  }
}
