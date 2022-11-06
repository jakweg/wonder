import { createStateUpdaterControllerFromReceived, StateUpdater } from './controller'
import { createNewStateUpdater } from './implementation'

export const STANDARD_GAME_TICK_RATE = 20

export const enum Status {
  Stopped,
  Terminated,
  RequestedStart,
  RequestedStop,
  Running,
}

export const enum BufferField {
  Status,
  FirstTickExecutedAt,
  LastTickFinishTime,
  TicksPerSecond,
  ExpectedTicksPerSecond,
  ExecutedTicksCounter,
  SIZE,
}

export { createNewStateUpdater, createStateUpdaterControllerFromReceived, StateUpdater }
