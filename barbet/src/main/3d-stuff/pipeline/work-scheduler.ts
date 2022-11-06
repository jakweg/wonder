import { World } from '@game/world/world'
import { GameMutex } from '@utils/game-mutex'
import { sharedMemoryIsAvailable } from '@utils/shared-memory'
import { FromWorker, spawnNew, ToWorker } from '@utils/worker/message-types/render-helper'
import { dispatch, Environment } from './scheduler-tasks'

export enum TaskType {
  CreateChunkMesh,
}

export type Task = { type: TaskType.CreateChunkMesh; chunkIndex: number }
export type TaskResult = {
  type: TaskType.CreateChunkMesh
  chunkIndex: number
  vertexBuffer: SharedArrayBuffer
  indicesBuffer: SharedArrayBuffer
  recreationId: number
}

export default interface RenderHelperWorkScheduler {
  setWorld(world: any): void
  scheduleTask(task: Task): Promise<TaskResult>
  terminate(): void
}

class WorkerImplementation implements RenderHelperWorkScheduler {
  private constructor(private readonly workers: Awaited<ReturnType<typeof spawnNew>>[]) {
    for (const w of workers) {
      w.receive.on(FromWorker.TaskDone, result => {
        const nextTask = this.tasksQueue.shift()
        if (nextTask == undefined) this.waitingWorkers.push(w)
        else w.send.send(ToWorker.ExecuteTask, nextTask)

        const resolve = this.taskIdToResolve.get(result.id)
        if (resolve) {
          this.taskIdToResolve.delete(result.id)
          resolve(result.task)
        }
      })
    }
    this.waitingWorkers = [...this.workers]
  }

  private nextTaskId: number = 1
  private readonly taskIdToResolve: Map<number, (result: TaskResult) => void> = new Map()
  private readonly tasksQueue: { id: number; task: Task }[] = []
  private readonly waitingWorkers: Awaited<ReturnType<typeof spawnNew>>[]

  public static async createNew(mutex: GameMutex, workersCount?: number): Promise<RenderHelperWorkScheduler> {
    const count = workersCount === undefined ? Math.max(1, (navigator['hardwareConcurrency'] / 2) | 0) : +workersCount

    const workers = await Promise['all']([...new Array(count)].map((_, i) => spawnNew(i)))

    let i = 0
    for (const w of workers) w.send.send(ToWorker.SetInitials, { mutex: mutex.pass(), id: i++ })

    return new WorkerImplementation(workers)
  }

  public setWorld(world: any): void {
    this.workers.forEach(e => e.send.send(ToWorker.SetWorld, world))
  }

  public scheduleTask(task: Task): Promise<TaskResult> {
    const readyWorker = this.waitingWorkers.pop()

    const id = this.nextTaskId++

    if (readyWorker == undefined) this.tasksQueue.push({ id, task })
    else readyWorker.send.send(ToWorker.ExecuteTask, { id, task })

    return new Promise<TaskResult>(resolve => {
      this.taskIdToResolve.set(id, resolve)
    })
  }

  public terminate(): void {
    this.workers.forEach(e => e.terminate())
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
  return sharedMemoryIsAvailable ? WorkerImplementation.createNew(mutex) : Promise.resolve(new InstantImplementation())
}
