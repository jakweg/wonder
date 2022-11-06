import IndexedState from '../../state/indexed-state'
import { FramesMeter } from './frames-meter'
import TimeMeter from './time-meter'
import { UpdatePhase } from './update-phase'

export const enum StatField {
  GameLoadTimeMs,
  UpdateTimes,
  UpdateTimesDetailed,
}

export const newStatsObject = () =>
  IndexedState.fromObject({
    [StatField.GameLoadTimeMs]: 0,
    [StatField.UpdateTimes]: new ArrayBuffer(0),
    [StatField.UpdateTimesDetailed]: new ArrayBuffer(0),
  })

export type UpdateDebugStats = ReturnType<typeof newStatsObject>

export class UpdateDebugDataCollector {
  private readonly rawStats = newStatsObject()
  private observingEnabled: boolean = false
  private receiveUpdatesCancelCallback: any = null
  public constructor(public readonly frames: FramesMeter, public readonly timeMeter: TimeMeter<UpdatePhase>) {
    this.rawStats.set(StatField.UpdateTimes, frames.getFrameTimeRaw()['buffer'])
    this.rawStats.set(StatField.UpdateTimesDetailed, timeMeter.getRawBuffer())
  }

  public setLoadingGameTime(ms: number) {
    this.rawStats.set(StatField.GameLoadTimeMs, ms)
  }

  public receiveUpdates(callback: (stats: any) => void) {
    if (this.observingEnabled) throw new Error()
    this.receiveUpdatesCancelCallback = this.rawStats.observeEverything(s => callback(s))
  }

  public stopUpdates() {
    this.timeMeter.setEnabled(false)
    this.receiveUpdatesCancelCallback?.()
  }
}
