import { BufferField, getSharedWallClockMs, Status } from './'

export interface StateUpdater {
  start(ticksPerSecond: number): void

  changeTickRate(ticksPerSecond: number): void

  getTickRate(): number

  getExecutedTicksCount(): number

  getCurrentStatus(): Status

  estimateCurrentGameTickTime(): number

  stop(): void
}

const f64View = new Float64Array(2)
const i32View = new Int32Array(f64View['buffer'])

const notifyUpdaterWake = (memory: Int32Array): void => {
  Atomics.add(memory, BufferField.WakeCounter, 1)
  Atomics.notify(memory, BufferField.WakeCounter)
}

export const createStateUpdaterControllerFromReceived = (data: any): StateUpdater => {
  const memory = new Int32Array(data.buffer)
  let lastEstimatedTick = Atomics.load(memory, BufferField.ExecutedTicksCounter)
  let lastScheduleVersion = -1

  return {
    start(ticksPerSecond: number) {
      Atomics.store(memory, BufferField.ExpectedTicksPerSecond, ticksPerSecond)
      Atomics.compareExchange(memory, BufferField.Status, Status.Stopped, Status.RequestedStart)
      notifyUpdaterWake(memory)
    },
    changeTickRate(ticksPerSecond: number) {
      Atomics.store(memory, BufferField.ExpectedTicksPerSecond, ticksPerSecond)
      notifyUpdaterWake(memory)
    },
    getTickRate(): number {
      return Atomics.load(memory, BufferField.TicksPerSecond)
    },
    getExecutedTicksCount(): number {
      return Atomics.load(memory, BufferField.ExecutedTicksCounter)
    },
    getCurrentStatus(): Status {
      return Atomics.load(memory, BufferField.Status) as Status
    },
    estimateCurrentGameTickTime(): number {
      let versionBefore: number
      let status: Status
      let executedTicks: number
      let runStartTick: number
      let runStartTime: number
      let tps: number

      // Spin-lock (seqlock) read loop waiting for an even, unchanged `ScheduleVersion`.
      // Safe in single-threaded mode as well: `publishScheduleSnapshot` updates `ScheduleVersion` synchronously
      // inside `try..finally` without yielding, so it can never be observed odd on the same thread.
      while (true) {
        versionBefore = Atomics.load(memory, BufferField.ScheduleVersion)
        if ((versionBefore & 1) !== 0) continue

        status = Atomics.load(memory, BufferField.Status) as Status
        executedTicks = Atomics.load(memory, BufferField.ExecutedTicksCounter)
        i32View[0] = Atomics.load(memory, BufferField.RunStartTickLow)
        i32View[1] = Atomics.load(memory, BufferField.RunStartTickHigh)
        i32View[2] = Atomics.load(memory, BufferField.RunStartTimeLow)
        i32View[3] = Atomics.load(memory, BufferField.RunStartTimeHigh)
        runStartTick = f64View[0]!
        runStartTime = f64View[1]!
        tps = Atomics.load(memory, BufferField.TicksPerSecond)

        const versionAfter = Atomics.load(memory, BufferField.ScheduleVersion)
        if (versionBefore === versionAfter) break
      }

      if (status !== Status.Running || tps <= 0) {
        const pausedTick = Math.max(
          executedTicks,
          Math.min(Math.max(lastEstimatedTick, runStartTick), executedTicks + 0.999999),
        )
        lastEstimatedTick = pausedTick
        return pausedTick
      }

      const elapsedTicks = ((getSharedWallClockMs() - runStartTime) * tps) / 1000
      const rawEstimated = runStartTick + elapsedTicks

      if (versionBefore !== lastScheduleVersion) {
        lastScheduleVersion = versionBefore
        // If update-worker re-anchored after saturation/lag (`lastEstimatedTick` had run >= 1 tick ahead
        // of `executedTicks`), adopt the new schedule immediately instead of freezing until caught up.
        if (lastEstimatedTick >= executedTicks + 1) {
          lastEstimatedTick = rawEstimated
        }
      }

      if (rawEstimated - executedTicks > 100) {
        return lastEstimatedTick
      }

      if (rawEstimated > lastEstimatedTick) {
        lastEstimatedTick = rawEstimated
      }
      return lastEstimatedTick
    },
    stop() {
      if (
        Status.RequestedStart ===
        Atomics.compareExchange(memory, BufferField.Status, Status.RequestedStart, Status.Stopped)
      ) {
        notifyUpdaterWake(memory)
        return // prevented starting
      }

      if (
        Status.Running === Atomics.compareExchange(memory, BufferField.Status, Status.Running, Status.RequestedStop)
      ) {
        notifyUpdaterWake(memory)
        return // requested stop from running
      }

      return // not done anything, already requested stop, stopped or terminated
    },
  }
}
