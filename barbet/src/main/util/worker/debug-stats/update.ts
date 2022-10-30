import IndexedState from "../../state/indexed-state"
import { FramesMeter } from "./frames-meter"

export const enum StatField {
    GameLoadTimeMs,
    UpdateTimes,
}

export const newStatsObject = () => IndexedState.fromObject({
    [StatField.GameLoadTimeMs]: 0,
    [StatField.UpdateTimes]: new ArrayBuffer(0),
})

export type UpdateDebugStats = ReturnType<typeof newStatsObject>

export class UpdateDebugDataCollector {

    private readonly rawStats = newStatsObject()
    private observingEnabled: boolean = false
    private receiveUpdatesCancelCallback: any = null
    public constructor(public readonly frames: FramesMeter) {
        this.rawStats.set(StatField.UpdateTimes, frames.getFrameTimeRaw()['buffer'])
    }

    public setLoadingGameTime(ms: number) {
        this.rawStats.set(StatField.GameLoadTimeMs, ms)
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