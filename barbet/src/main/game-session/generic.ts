import {
  CreateGameArguments,
  CreateGameResult,
  createNewEnvironment,
  GameListeners,
} from '@entry/feature-environments/loader'
import { Status } from '@game/state-updater'
import ActionsBroadcastHelper from '../network/actions-broadcast-helper'
import { TickQueueAction, TickQueueActionType } from '../network/tick-queue-action'

interface Props {
  canvasProvider: () => HTMLCanvasElement | undefined
  sendActionsCallback: ConstructorParameters<typeof ActionsBroadcastHelper>[0]
}

export const createGenericSession = async (props: Props) => {
  const environment = await createNewEnvironment()

  const actionsHelper = new ActionsBroadcastHelper(props.sendActionsCallback)
  let currentGame: CreateGameResult | null = null

  const gameListener: GameListeners = {
    onInputCaused: action => {
      actionsHelper.enqueueAction({
        type: TickQueueActionType.GameAction,
        action: action,
      })
    },
    onTickCompleted: tick => {
      actionsHelper.tickDone(tick)
    },
  }

  let latencyMilliseconds = 0
  let tpsForLatency = 0
  const calculateAndSetLatencyTicks = () => {
    const ms = Math.max(10, Math.min(2000, latencyMilliseconds)) | 0
    const tps = Math.max(1, tpsForLatency) | 0

    const msPerTick = 1000 / tps
    const ticks = Math.max(1, Math.ceil(ms / msPerTick) | 0) + 1

    console.log(ticks)

    actionsHelper.setLatencyTicksCount(ticks)
  }

  return {
    isMultiplayer: () => {
      throw new Error()
    },
    forwardPlayerActions(tick: number, player: string, actions: TickQueueAction[]) {
      currentGame?.setActionsCallback(tick, player, actions)
    },
    async createNewGame(args: CreateGameArguments): Promise<CreateGameResult> {
      if (currentGame !== null) throw new Error('already loaded')
      const result = (currentGame = await environment.createNewGame(args))
      actionsHelper.initializeFromTick(result.updater.getExecutedTicksCount())

      result.setGameListeners(gameListener)

      this.resetRendering()
      return result
    },
    setLatencyMilliseconds(ms: number) {
      latencyMilliseconds = ms
      calculateAndSetLatencyTicks()
    },
    start(playerIds: string[], tps: number): void {
      if (!currentGame) throw new Error('no game')

      currentGame.setPlayerIdsCallback(playerIds)

      const ticksCount = currentGame.updater.getExecutedTicksCount()
      actionsHelper.tickDone(ticksCount)

      currentGame.updater.start(tps)

      tpsForLatency = tps
      calculateAndSetLatencyTicks()
    },
    resetRendering() {
      const canvas = props.canvasProvider()
      if (canvas) environment.startRender({ canvas })
    },
    stop(): boolean {
      const previousStatus = currentGame?.updater.getCurrentStatus()
      currentGame?.updater.stop()

      return previousStatus === Status.Running
    },
    isRunning(): boolean {
      return currentGame?.updater.getCurrentStatus() === Status.Running
    },
    terminate(): void {
      environment.terminate({ terminateEverything: true })
    },
    getEnvironment() {
      return environment
    },
    getCurrentGame() {
      return currentGame
    },
  }
}
