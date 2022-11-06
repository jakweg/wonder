import IndexedState from '../../state/indexed-state'
import { FramesMeter } from './frames-meter'

export const enum StatField {
  RendererName,
  DrawCallsCount,
  VisibleChunksCount,
  DrawTimesBuffer,
}

export const newStatsObject = () =>
  IndexedState.fromObject({
    [StatField.RendererName]: '?' as string,
    [StatField.DrawCallsCount]: 0 as number,
    [StatField.VisibleChunksCount]: 0 as number,
    [StatField.DrawTimesBuffer]: new ArrayBuffer(0),
  })

export type RenderDebugStats = ReturnType<typeof newStatsObject>

export class RenderDebugDataCollector {
  private readonly rawStats = newStatsObject()
  private observingEnabled: boolean = false
  private receiveUpdatesCancelCallback: any = null
  public updateTimesBuffer: SharedArrayBuffer | null = null
  public constructor(public readonly frames: FramesMeter) {}

  public setRendererName(name: string) {
    this.rawStats.set(StatField.RendererName, name || '?')
  }

  public incrementDrawCalls(value: number = 1) {
    this.rawStats.set(StatField.DrawCallsCount, this.rawStats.get(StatField.DrawCallsCount) + value)
  }
  public setVisibleChunksCount(count: number) {
    this.rawStats.set(StatField.VisibleChunksCount, count)
  }
  public updateWithTimeMeasurements(raw: Readonly<ArrayBuffer>) {
    this.rawStats.edit().set(StatField.DrawTimesBuffer, raw).commit()
  }

  public receiveUpdates(callback: (stats: any) => void) {
    if (this.observingEnabled) throw new Error()
    this.receiveUpdatesCancelCallback = this.rawStats.observeEverything(s => callback(s))
  }

  public stopUpdates() {
    this.observingEnabled = false
    this.receiveUpdatesCancelCallback?.()
  }
}
