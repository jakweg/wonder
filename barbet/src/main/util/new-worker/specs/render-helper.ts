import { Task, TaskResult } from '@3d/pipeline/work-scheduler'
import { bind as genericBind } from '../worker-instance'

import { spawnNew as genericSpawnNew, WorkerSpecification } from '@utils/new-worker/worker-instance'

const spec = {
  scriptName: 'render-helper-worker',
  to: {
    executeTask: {} as { argument: Task; result: TaskResult },
    setInitials: {} as { argument: { mutex: any; id: number } },
    setWorld: {} as { argument: any },
  },
  from: {},
} as const satisfies WorkerSpecification<any, any>

export const spawnNew = (l: Parameters<typeof genericSpawnNew<typeof spec>>[1]) => genericSpawnNew(spec, l)
export const bind = (l: Parameters<typeof genericBind<typeof spec>>[1]) => genericBind(spec, l)
