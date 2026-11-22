import { waitAsyncCompat } from '@utils/game-mutex'
import { createNewBuffer } from '@utils/shared-memory'
import TickQueue from '../../network/tick-queue'
import { TickQueueActionType, UpdaterAction } from '../../network/tick-queue-action'
import { ScheduledAction } from '../scheduled-actions'
import { BufferField, getSharedWallClockMs, Status } from './'

export interface StateUpdaterImplementation {
  pass(): unknown

  terminate(): void
}

const f64View = new Float64Array(2)
const i32View = new Int32Array(f64View['buffer'])

const publishScheduleSnapshot = (memory: Int32Array, runStartTick: number, runStartTime: number, tps: number): void => {
  // Readers in `controller.ts` spin-lock while `ScheduleVersion` is odd; keep the odd->even transition
  // wrapped in `try..finally` so `ScheduleVersion` is guaranteed to return to even and never deadlock readers.
  const oddVersion = (Atomics.load(memory, BufferField.ScheduleVersion) + 1) | 0
  Atomics.store(memory, BufferField.ScheduleVersion, oddVersion)
  try {
    f64View[0] = runStartTick
    f64View[1] = runStartTime
    Atomics.store(memory, BufferField.RunStartTickLow, i32View[0]!)
    Atomics.store(memory, BufferField.RunStartTickHigh, i32View[1]!)
    Atomics.store(memory, BufferField.RunStartTimeLow, i32View[2]!)
    Atomics.store(memory, BufferField.RunStartTimeHigh, i32View[3]!)
    Atomics.store(memory, BufferField.TicksPerSecond, tps | 0)
  } finally {
    Atomics.store(memory, BufferField.ScheduleVersion, (oddVersion + 1) | 0)
  }
}

const waitForStatusNotStopped = async (memory: Int32Array): Promise<Status> => {
  while (true) {
    const wakeBefore = Atomics.load(memory, BufferField.WakeCounter)
    const status = Atomics.load(memory, BufferField.Status) as Status
    if (status !== Status.Stopped) return status

    await waitAsyncCompat(memory, BufferField.WakeCounter, wakeBefore, 50)['value']
  }
}

const executeSingleTick = async (
  memory: Int32Array,
  tickNumberToExecute: number,
  func: (tick: number) => Promise<boolean>,
): Promise<boolean> => {
  try {
    const executedTick = await func(tickNumberToExecute)
    if (executedTick) {
      Atomics.store(memory, BufferField.ExecutedTicksCounter, tickNumberToExecute)
      return true
    }
    return false
  } catch (e) {
    console.error(e)
    console.error('Terminating state updater')
    Atomics.store(memory, BufferField.Status, Status.Terminated)
    throw new Error(String(e))
  }
}

const runSession = async (
  memory: Int32Array,
  getSavedPhaseTick: () => number,
  setSavedPhaseTick: (phaseTick: number) => void,
  func: (tick: number) => Promise<boolean>,
) => {
  const initialStatus = Atomics.load(memory, BufferField.Status) as Status
  if (Status.RequestedStart !== initialStatus && Status.Running !== initialStatus) return

  let activeTps = Atomics.load(memory, BufferField.ExpectedTicksPerSecond)
  if (activeTps <= 0) throw new Error(`Invalid tps ${activeTps}`)

  const initialExecuted = Atomics.load(memory, BufferField.ExecutedTicksCounter)
  let runStartTick = Math.max(initialExecuted, Math.min(getSavedPhaseTick(), initialExecuted + 0.999999))
  let runStartTime = getSharedWallClockMs()

  publishScheduleSnapshot(memory, runStartTick, runStartTime, activeTps)

  if (initialStatus === Status.RequestedStart) {
    const previousValue = Atomics.compareExchange(memory, BufferField.Status, Status.RequestedStart, Status.Running)
    if (previousValue !== Status.RequestedStart) return
  }

  while (true) {
    const wakeBefore = Atomics.load(memory, BufferField.WakeCounter)
    const currentStatus = Atomics.load(memory, BufferField.Status) as Status
    if (currentStatus !== Status.Running) {
      const now = getSharedWallClockMs()
      const executed = Atomics.load(memory, BufferField.ExecutedTicksCounter)
      const currentPhase = runStartTick + ((now - runStartTime) * activeTps) / 1000
      const frozenTick = Math.max(executed, Math.min(currentPhase, executed + 0.999999))
      setSavedPhaseTick(frozenTick)
      publishScheduleSnapshot(memory, frozenTick, now, 0)
      return
    }

    const expectedTps = Atomics.load(memory, BufferField.ExpectedTicksPerSecond)
    if (expectedTps !== activeTps && expectedTps > 0) {
      const nowBeforeTransition = getSharedWallClockMs()
      const executedBefore = Atomics.load(memory, BufferField.ExecutedTicksCounter)
      const phaseBefore = runStartTick + ((nowBeforeTransition - runStartTime) * activeTps) / 1000

      // If a single tick boundary was just crossed right before the TPS change, commit it cleanly first
      if (phaseBefore >= executedBefore + 1 && phaseBefore < executedBefore + 2) {
        await executeSingleTick(memory, executedBefore + 1, func)
      }

      const nowAfterTransition = getSharedWallClockMs()
      const latestExecuted = Atomics.load(memory, BufferField.ExecutedTicksCounter)
      const phaseNow = runStartTick + ((nowAfterTransition - runStartTime) * activeTps) / 1000

      // Preserve exact fractional tick progress across TPS changes without firing spurious extra ticks
      runStartTick = Math.max(latestExecuted, Math.min(phaseNow, latestExecuted + 0.999999))
      runStartTime = nowAfterTransition
      activeTps = expectedTps
      setSavedPhaseTick(runStartTick)
      publishScheduleSnapshot(memory, runStartTick, runStartTime, activeTps)
      continue
    }

    const now = getSharedWallClockMs()
    const millisPerTick = 1000 / activeTps
    const scheduledTickNow = runStartTick + (now - runStartTime) / millisPerTick
    const shouldBeNowAtTick = Math.floor(scheduledTickNow)
    const currentTick = Atomics.load(memory, BufferField.ExecutedTicksCounter)
    const ticksToExecute = shouldBeNowAtTick - currentTick

    if (ticksToExecute > 100 || ticksToExecute < 0) {
      console.warn('lag?')
      runStartTick = currentTick
      runStartTime = getSharedWallClockMs()
      setSavedPhaseTick(runStartTick)
      publishScheduleSnapshot(memory, runStartTick, runStartTime, activeTps)
      continue
    }

    if (ticksToExecute > 0) {
      let stalledOnTickQueue = false
      for (let i = 0; i < ticksToExecute; i++) {
        if (Atomics.load(memory, BufferField.Status) !== Status.Running) break
        if (Atomics.load(memory, BufferField.ExpectedTicksPerSecond) !== activeTps) break

        const tickNumberToExecute = currentTick + i + 1
        const executedOk = await executeSingleTick(memory, tickNumberToExecute, func)
        if (!executedOk) {
          stalledOnTickQueue = true
          break
        }
      }

      if (stalledOnTickQueue) {
        // Yield briefly so incoming `appendToTickQueue` postMessages run on the worker event loop,
        // and prevent `scheduledTickNow` from running away while waiting on queued tick actions.
        const stallNow = getSharedWallClockMs()
        const latestExecuted = Atomics.load(memory, BufferField.ExecutedTicksCounter)
        const stallPhase = runStartTick + (stallNow - runStartTime) / millisPerTick
        if (stallPhase >= latestExecuted + 1.5) {
          runStartTick = latestExecuted + 0.999
          runStartTime = stallNow
          setSavedPhaseTick(runStartTick)
          publishScheduleSnapshot(memory, runStartTick, runStartTime, activeTps)
        }
        await new Promise(resolve => setTimeout(resolve, 2))
        continue
      }

      // Yield a macrotask turn so worker `postMessage` handlers can process between tick batches
      await new Promise(resolve => setTimeout(resolve, 0))
      continue
    }

    const afterCheckNow = getSharedWallClockMs()
    const currentPhase = runStartTick + (afterCheckNow - runStartTime) / millisPerTick
    const nextTickTarget = currentTick + 1
    const msUntilNextTick = (nextTickTarget - currentPhase) * millisPerTick
    if (msUntilNextTick > 0) {
      await waitAsyncCompat(memory, BufferField.WakeCounter, wakeBefore, msUntilNextTick)['value']
    } else {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
}

const loop = async (
  memory: Int32Array,
  getSavedPhaseTick: () => number,
  setSavedPhaseTick: (phaseTick: number) => void,
  func: (tick: number) => Promise<boolean>,
) => {
  while (true) {
    const status = await waitForStatusNotStopped(memory)
    if (status === Status.Terminated) return

    switch (status) {
      case Status.RequestedStop:
        Atomics.compareExchange(memory, BufferField.Status, status, Status.Stopped)
        break

      case Status.Running:
      case Status.RequestedStart:
        await runSession(memory, getSavedPhaseTick, setSavedPhaseTick, func)
        break

      default:
        throw new Error()
    }
  }
}

export const createNewStateUpdater = (
  updatable: (gameActions: ScheduledAction[], updaterActions: UpdaterAction[]) => Promise<void>,
  startFromTick: number,
  tickQueue: TickQueue,
): StateUpdaterImplementation => {
  const memory = new Int32Array(createNewBuffer(BufferField.SIZE * Int32Array.BYTES_PER_ELEMENT))
  memory.fill(0)
  memory[BufferField.Status] = Status.Stopped
  memory[BufferField.ExecutedTicksCounter] = startFromTick

  let savedPhaseTick = startFromTick
  publishScheduleSnapshot(memory, startFromTick, getSharedWallClockMs(), 0)

  const tryRun = async (tick: number): Promise<boolean> => {
    const actions = tickQueue.popActionsForTick(tick)
    if (actions !== undefined) {
      const updaterActions = actions
        .filter(e => e.type === TickQueueActionType.UpdaterAction)
        .map(e => e.action) as UpdaterAction[]
      const gameActions = actions
        .filter(e => e.type === TickQueueActionType.GameAction)
        .map(e => e.action) as ScheduledAction[]

      await updatable(gameActions, updaterActions)
      if (updaterActions.length > 0) {
        for (const action of updaterActions) {
          switch (action.type) {
            case 'pause':
              Atomics.compareExchange(memory, BufferField.Status, Status.Running, Status.RequestedStop)
              Atomics.add(memory, BufferField.WakeCounter, 1)
              Atomics.notify(memory, BufferField.WakeCounter)
              break
          }
        }
      }
      return true
    }
    return false
  }

  // noinspection JSIgnoredPromiseFromCall
  loop(
    memory,
    () => savedPhaseTick,
    phaseTick => {
      savedPhaseTick = phaseTick
    },
    tryRun,
  )

  return {
    pass(): unknown {
      return { buffer: memory['buffer'] }
    },
    terminate(): void {
      Atomics.store(memory, BufferField.Status, Status.Terminated)
      Atomics.add(memory, BufferField.WakeCounter, 1)
      Atomics.notify(memory, BufferField.WakeCounter)
    },
  }
}
