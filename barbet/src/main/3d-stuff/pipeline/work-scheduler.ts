import { World } from '@game/world/world'
import TypedArray from '@seampan/typed-array'
import { createArray } from '@utils/array-utils'
import { GameMutex } from '@utils/game-mutex'
import { spawnNew } from '@utils/new-worker/specs/render-helper'
import { dispatch, Environment } from './scheduler-tasks'

export enum TaskType {
  /** @deprecated */
  CreateChunkMesh,
  Create2dChunkMesh,
}

export type Task =
  | { type: TaskType.CreateChunkMesh; chunkIndex: number }
  | { type: TaskType.Create2dChunkMesh; chunkIndex: number }

export type TaskResult =
  | {
      type: TaskType.CreateChunkMesh
      chunkIndex: number
      vertexBuffer: SharedArrayBuffer
      indicesBuffer: SharedArrayBuffer
      recreationId: number
    }
  | {
      type: TaskType.Create2dChunkMesh
      chunkIndex: number
      top: TypedArray
      recreationId: number
      sidesVertexes: TypedArray
      sidesElements: TypedArray
    }

export default interface RenderHelperWorkScheduler {
  setWorld(world: any): void
  scheduleTask(task: Task): Promise<TaskResult>
  terminate(): void
}

class WorkerImplementation implements RenderHelperWorkScheduler {
  private constructor(private readonly workers: Awaited<ReturnType<typeof spawnNew>>[]) {
    this.idleWorkers = [...this.workers]
  }

  private readonly tasksWaitingForExecution: { task: Task; resolve: (t: TaskResult) => void }[] = []
  private readonly idleWorkers: Awaited<ReturnType<typeof spawnNew>>[]

  public static async createNew(mutex: GameMutex, workersCount?: number): Promise<RenderHelperWorkScheduler> {
    const count = workersCount === undefined ? Math.max(1, (navigator['hardwareConcurrency'] / 2) | 0) : +workersCount

    let i = 0
    const workers = await Promise['all'](
      createArray(count, async () => {
        const worker = await spawnNew({})
        await worker.functions.setInitials({ mutex: mutex.pass(), id: i++ })
        return worker
      }),
    )

    return new WorkerImplementation(workers)
  }

  public setWorld(world: any): void {
    this.workers.forEach(e => e.functions.setWorld(world))
  }

  public scheduleTask(task: Task): Promise<TaskResult> {
    return new Promise<TaskResult>(resolve => {
      this.tasksWaitingForExecution.push({ task, resolve })
      this.considerExecutingNextJob()
    })
  }

  public terminate(): void {
    this.workers.forEach(e => e.terminate())
  }

  private considerExecutingNextJob() {
    const worker = this.idleWorkers.pop()
    if (!worker) {
      return
    }

    const task = this.tasksWaitingForExecution.pop()
    if (!task) {
      this.idleWorkers.push(worker)
      return
    }

    // we have both worker and task
    worker.functions.executeTask(task.task).then(result => {
      this.idleWorkers.push(worker)
      this.considerExecutingNextJob()

      task.resolve(result)
    })
  }
}

class InstantImplementation implements RenderHelperWorkScheduler {
  private env: Environment = {
    mutexEnter: () => void 0,
    mutexExit: () => void 0,
    world: null as any,
  }

  setWorld(world: any): void {
    this.env.world = World.fromReceived(world)
  }
  scheduleTask(task: Task): Promise<TaskResult> {
    return dispatch(this.env, task)
  }
  terminate(): void {
    // nothing to do
  }
}

export const newHelperScheduler = (mutex: GameMutex): Promise<RenderHelperWorkScheduler> => {
  // TODO remove
  return Promise.resolve(new InstantImplementation())
  // return sharedMemoryIsAvailable ? WorkerImplementation.createNew(mutex) : Promise.resolve(new InstantImplementation())
}
