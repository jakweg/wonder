import { DEBUG, JS_ROOT } from '@build'
import { ScheduledAction } from '@game/scheduled-actions'
import { StateUpdater } from '@game/state-updater'
import { SaveGameArguments, SaveGameResult, SaveMethod } from '@game/world/world-saver'
import CONFIG from '@utils/persistence/observable-settings'
import { getCameraBuffer } from '@utils/persistence/serializable-settings'
import { sharedMemoryIsAvailable } from '@utils/shared-memory'
import { RenderDebugStats } from '@utils/worker/debug-stats/render'
import { UpdateDebugStats } from '@utils/worker/debug-stats/update'
import { UICanvas } from 'src/main/ui/canvas-background'
import { TickQueueAction } from '../../network/tick-queue-action'

export interface ConnectArguments {
  camera: SharedArrayBuffer
  settings: typeof CONFIG
}

export const enum Environment {
  SingleThreaded = 'single-threaded',
  MultiThreaded = 'multi-threaded',
}

export interface StartRenderArguments {
  canvas: UICanvas
}

export interface CreateGameArguments {
  saveName?: string
  fileToRead?: File
  stringToRead?: string
}

export interface TerminateGameArguments {
  terminateEverything?: boolean
}

export type SetActionsCallback = (forTick: number, playerId: string, actions: TickQueueAction[]) => void

export interface GameListeners {
  onTickCompleted(tick: number): void

  onInputCaused(action: ScheduledAction): void
}

export interface CreateGameResult {
  renderDebugStats: RenderDebugStats
  updateDebugStats: UpdateDebugStats
  updater: StateUpdater
  setPlayerIdsCallback: (ids: string[]) => void
  setActionsCallback: SetActionsCallback
  setGameListeners: (listeners: GameListeners) => void
}

export interface EnvironmentConnection {
  name: string

  createNewGame(gameArgs: CreateGameArguments, renderArgs: StartRenderArguments): Promise<CreateGameResult>

  saveGame<T extends SaveMethod>(args: SaveGameArguments<T>): Promise<SaveGameResult<T>>

  terminate(args: TerminateGameArguments): void
}

export const getSuggestedEnvironmentName = (preferredEnvironment: Environment) => {
  let usedEnvironment: Environment = Environment.SingleThreaded

  const offscreenCanvasIsAvailable = !!(window as any).OffscreenCanvas
  if (sharedMemoryIsAvailable && offscreenCanvasIsAvailable && preferredEnvironment !== Environment.SingleThreaded) {
    usedEnvironment = Environment.MultiThreaded
  }
  return usedEnvironment
}

export const loadEnvironment = async (name: Environment): Promise<Readonly<EnvironmentConnection>> => {
  const connect = (await import(`${JS_ROOT}/feature-environments/${name}.js`))['bind']
  const args: ConnectArguments = {
    camera: getCameraBuffer(),
    settings: CONFIG,
  }
  return Object.freeze((await connect(args)) as EnvironmentConnection)
}

const addWorkerPrefetch = (name: string) => {
  const link = document['createElement']('link')
  link['setAttribute']('rel', 'prefetch')
  link['setAttribute']('as', 'worker')
  link['setAttribute']('href', `${JS_ROOT}/${name}-worker.js`)
  document['head']['appendChild'](link)
}

const preloadWorkers = () => {
  if (DEBUG) return
  addWorkerPrefetch('update')
  addWorkerPrefetch('render')
  addWorkerPrefetch('render-helper')
}

export const createNewEnvironment = async (): Promise<EnvironmentConnection> => {
  const suggestedName = getSuggestedEnvironmentName(CONFIG.get('other/preferred-environment') as Environment)
  if (suggestedName === Environment.MultiThreaded) preloadWorkers()

  return await loadEnvironment(suggestedName)
}
