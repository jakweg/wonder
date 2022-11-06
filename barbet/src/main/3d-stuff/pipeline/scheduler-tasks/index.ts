import { World } from '../../../game-state/world/world'
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
    default:
      throw new Error()
  }
}
