import { TickQueueAction } from './tick-queue-action'

export default class ActionsBroadcastHelper {
  private eventsToSend: { tick: number; action: TickQueueAction }[] = []
  private latencyTicksCount: number = 10
  private lastExecutedTick: number = 0
  private lastSendTick: number = 0

  constructor(private readonly onSend: (tick: number, actions: TickQueueAction[]) => void) {}

  public enqueueAction(action: TickQueueAction): void {
    this.eventsToSend.push({ tick: this.lastExecutedTick + this.latencyTicksCount + 1, action })
  }

  public initializeFromTick(tick: number): void {
    this.eventsToSend.splice(0)
    this.lastExecutedTick = this.lastSendTick = tick
  }

  public tickDone(tick: number): void {
    this.lastExecutedTick = tick
    this.checkIfNeedsToSend()
  }

  public setLatencyTicksCount(count: number): void {
    this.latencyTicksCount = count
    this.checkIfNeedsToSend()
  }

  public checkIfNeedsToSend(): void {
    const difference = this.lastSendTick - this.lastExecutedTick
    if (difference >= this.latencyTicksCount) return

    const needsSendCount = this.latencyTicksCount - difference

    for (let i = 1; i <= needsSendCount; i++) {
      const tick = this.lastSendTick + i
      const actionsForThisTick: TickQueueAction[] = []
      while (this.eventsToSend.length > 0) {
        const action = this.eventsToSend[0]!
        if (action.tick !== tick) break
        this.eventsToSend.shift()
        actionsForThisTick.push(action.action)
      }

      this.onSend(tick, actionsForThisTick)
    }
    this.lastSendTick += needsSendCount
  }
}
