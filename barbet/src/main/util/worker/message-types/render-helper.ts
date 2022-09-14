import { Task, TaskResult } from "../../../3d-stuff/pipeline/work-scheduler";
import { WorkerInstance } from "../worker-instance";
import { genericBind } from "../worker-listener";

export const enum ToWorker {
    ExecuteTask,
    SetInitials,
    SetWorld,
}

type ToTypes = {
    [ToWorker.ExecuteTask]: { id: number, task: Task }
    [ToWorker.SetInitials]: { mutex: any, id: number }
    [ToWorker.SetWorld]: any
}

export const enum FromWorker {
    TaskDone,
}

interface FromTypes {
    [FromWorker.TaskDone]: { id: number, task: TaskResult }
}

export const spawnNew = (id: number) => WorkerInstance
    .spawnNew<ToTypes, FromTypes>('render-helper-worker', `render-helper-${id}`)

export const bind = () => genericBind<FromTypes, ToTypes>()
