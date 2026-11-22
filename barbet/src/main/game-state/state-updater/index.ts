import { createStateUpdaterControllerFromReceived, StateUpdater } from './controller'
import { createNewStateUpdater } from './implementation'

export const STANDARD_GAME_TICK_RATE = 20

export const getSharedWallClockMs = (): number => performance.timeOrigin + performance.now()

export const enum Status {
  Stopped,
  Terminated,
  RequestedStart,
  RequestedStop,
  Running,
}

export const enum BufferField {
  Status,
  ScheduleVersion,
  WakeCounter,
  RunStartTickLow,
  RunStartTickHigh,
  RunStartTimeLow,
  RunStartTimeHigh,
  TicksPerSecond,
  ExpectedTicksPerSecond,
  ExecutedTicksCounter,
  SIZE,
}

export { createNewStateUpdater, createStateUpdaterControllerFromReceived, StateUpdater }
