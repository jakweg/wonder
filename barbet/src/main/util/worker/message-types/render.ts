import { TerminateGameArguments } from '@entry/feature-environments/loader'
import { ScheduledAction } from '@game/scheduled-actions'
import { WorkerInstance } from '../worker-instance'
import { genericBind } from '../worker-listener'

export const enum ToWorker {
  GameMutex,
  NewSettings,
  FrontendVariables,
  CameraBuffer,
  SetWorkerLoadDelays,
  UpdateEntityContainer,
  TerminateGame,
  TransferCanvas,
  GameCreateResult,
  UpdateTimesBuffer,
}

interface ToTypes {
  [ToWorker.GameMutex]: any
  [ToWorker.NewSettings]: any
  [ToWorker.FrontendVariables]: { buffer: SharedArrayBuffer }
  [ToWorker.CameraBuffer]: { buffer: SharedArrayBuffer }
  [ToWorker.SetWorkerLoadDelays]: { update: number; render: number }
  [ToWorker.UpdateEntityContainer]: { buffers: SharedArrayBuffer[] }
  [ToWorker.TerminateGame]: TerminateGameArguments
  [ToWorker.TransferCanvas]: { canvas: unknown }
  [ToWorker.GameCreateResult]: { game: unknown; updater: unknown }
  [ToWorker.UpdateTimesBuffer]: { buffer: SharedArrayBuffer }
}

export const enum FromWorker {
  ScheduledAction,
  DebugStatsUpdate,
}

interface FromTypes {
  [FromWorker.ScheduledAction]: ScheduledAction
  [FromWorker.DebugStatsUpdate]: any
}

export const spawnNew = () => WorkerInstance.spawnNew<ToTypes, FromTypes>('render-worker', 'render')

export const bind = () => genericBind<FromTypes, ToTypes>()
