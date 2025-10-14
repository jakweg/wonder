import { spawnNew as genericSpawnNew, WorkerSpecification } from '@utils/new-worker/worker-instance'
import { Operation } from '../../../game-session'
import { TickQueueAction } from '../../../network/tick-queue-action'
import { bind as genericBind } from '../worker-instance'

const spec = {
  scriptName: 'network-worker',
  to: {
    connect: {} as { argument: { address: string }; result: { success: boolean } },
    joinRoom: {} as { argument: { roomId: string }; result: { ok: true; roomId: string } | { ok: false } },
    setPreventJoins: {} as { argument: { prevent: boolean } },
    setLatencyMilliseconds: {} as { argument: { ms: number } },
    broadcastGameState: {} as { argument: { serializedState: string } },
    broadcastMyActions: {} as { argument: { tick: number; actions: TickQueueAction[] } },
    broadcastOperation: {} as { argument: Operation },
  },
  from: {
    onStateUpload: {} as { argument: any },
    onConnectionDropped: {} as { argument: null },
    onGameState: {} as { argument: { serializedState: string } },
    onPlayerActions: {} as { argument: { from: string; tick: number; actions: TickQueueAction[] } },
    onGotOperation: {} as { argument: Operation },
  },
} as const satisfies WorkerSpecification<any, any>

export const spawnNew = (l: Parameters<typeof genericSpawnNew<typeof spec>>[1]) => genericSpawnNew(spec, l)
export const bind = (l: Parameters<typeof genericBind<typeof spec>>[1]) => genericBind(spec, l)
