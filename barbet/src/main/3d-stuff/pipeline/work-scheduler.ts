import { GameMutex } from "../../util/game-mutex"
import { FromWorker, spawnNew, ToWorker } from "../../util/worker/message-types/render-helper"

export enum TaskType {
    CreateChunkMesh,
}

export type Task = { type: TaskType.CreateChunkMesh, chunkIndex: number }
export type TaskResult = { type: TaskType.CreateChunkMesh, chunkIndex: number, vertexBuffer: SharedArrayBuffer, indicesBuffer: SharedArrayBuffer }

export default class RenderHelperWorkScheduler {
    private constructor(private readonly workers: Awaited<ReturnType<typeof spawnNew>>[]) {
        for (const w of workers) {
            w.receive.on(FromWorker.TaskDone, result => {
                const nextTask = this.tasksQueue.shift()
                if (nextTask == undefined)
                    this.waitingWorkers.push(w)
                else
                    w.send.send(ToWorker.ExecuteTask, nextTask)

                const resolve = this.taskIdToResolve.get(result.id)
                if (resolve) {
                    this.taskIdToResolve.delete(result.id)
                    resolve(result.task)
                }
            })
        }
    }

    private nextTaskId: number = 1
    private readonly taskIdToResolve: Map<number, (result: TaskResult) => void> = new Map()
    private readonly tasksQueue: { id: number, task: Task }[] = []
    private readonly waitingWorkers: Awaited<ReturnType<typeof spawnNew>>[] = [...this.workers]

    public static async createNew(mutex: GameMutex, workersCount?: number): Promise<RenderHelperWorkScheduler> {

        const count = workersCount === undefined ? Math.max(1, (navigator['hardwareConcurrency'] / 2) | 0) : +workersCount

        const workers = await Promise.all([...new Array(count)]
            .map((_, i) => spawnNew(i)))

        let i = 0
        for (const w of workers)
            w.send.send(ToWorker.SetInitials, { mutex: mutex.pass(), id: i++ })

        return new RenderHelperWorkScheduler(workers)
    }

    public setWorld(world: any): void {
        this.workers.forEach(e => e.send.send(ToWorker.SetWorld, world))
    }

    public scheduleTask(task: Task): Promise<TaskResult> {
        const readyWorker = this.waitingWorkers.pop()

        const id = this.nextTaskId++

        if (readyWorker == undefined)
            this.tasksQueue.push({ id, task })
        else
            readyWorker.send.send(ToWorker.ExecuteTask, { id, task })

        return new Promise<TaskResult>(resolve => {
            this.taskIdToResolve.set(id, resolve)
        })
    }

    public terminate(): void {
        this.workers.forEach(e => e.terminate())
    }
}

