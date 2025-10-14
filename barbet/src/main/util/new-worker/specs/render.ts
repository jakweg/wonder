import { TerminateGameArguments } from '@entry/feature-environments/loader'
import {
  bind as genericBind,
  spawnNew as genericSpawnNew,
  WorkerSpecification,
} from '@utils/new-worker/worker-instance'

import { RenderingSessionStartArgs } from '@3d/new-render-context'
import { ScheduledAction } from '@game/scheduled-actions'

const spec = {
  scriptName: 'render-worker',
  to: {
    setGameMutex: {} as { argument: any },
    setNewSettings: {} as { argument: any },
    startRenderingSession: {} as { argument: RenderingSessionStartArgs; transferable: true },
    /** @deprecated */
    updateEntityContainer: {} as { argument: { buffers: SharedArrayBuffer[] } },
    terminateGame: {} as { argument: TerminateGameArguments },
    /** @deprecated not sure if should be deprecated */
    setUpdateTimesBuffer: {} as { argument: { buffer: SharedArrayBuffer } },
  },
  from: {
    /** @deprecated we want to migrate from `worker pushing actions to outside` to `outside requesting interpretations of requests` to inside */
    scheduleAction: {} as { argument: ScheduledAction },
    updateDebugStats: {} as { argument: any },
  },
} as const satisfies WorkerSpecification<any, any>

export const spawnNew = (l: Parameters<typeof genericSpawnNew<typeof spec>>[1]) => genericSpawnNew(spec, l)
export const bind = (l: Parameters<typeof genericBind<typeof spec>>[1]) => genericBind(spec, l)
