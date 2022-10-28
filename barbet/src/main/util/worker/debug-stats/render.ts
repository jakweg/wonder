import { DrawPhase } from "../../../3d-stuff/renderable/draw-phase"
import IndexedState from "../../state/indexed-state"

export const enum StatField {
    RendererName,
    DrawCallsCount,
    VisibleChunksCount,
    DrawTime_HandleInputs,
    DrawTime_LockMutex,
    DrawTime_UpdateWorld,
    DrawTime_PrepareRender,
    DrawTime_GPUUpload,
    DrawTime_Draw,
    DrawTime_DrawForMousePicker,
}

export const newStatsObject = () => IndexedState.fromObject({
    [StatField.RendererName]: '?' as string,
    [StatField.DrawCallsCount]: 0 as number,
    [StatField.VisibleChunksCount]: 0 as number,
    [StatField.DrawTime_HandleInputs]: 0,
    [StatField.DrawTime_LockMutex]: 0,
    [StatField.DrawTime_UpdateWorld]: 0,
    [StatField.DrawTime_PrepareRender]: 0,
    [StatField.DrawTime_GPUUpload]: 0,
    [StatField.DrawTime_Draw]: 0,
    [StatField.DrawTime_DrawForMousePicker]: 0,
})

export type RenderDebugStats = ReturnType<typeof newStatsObject>

export class RenderDebugDataCollector {

    private readonly rawStats = newStatsObject()
    private observingEnabled: boolean = false
    private receiveUpdatesCancelCallback: any = null
    public constructor() {
    }

    public setRendererName(name: string) {
        this.rawStats.set(StatField.RendererName, name || '?')
    }

    public incrementDrawCalls() {
        this.rawStats.set(StatField.DrawCallsCount, this.rawStats.get(StatField.DrawCallsCount) + 1)
    }
    public setVisibleChunksCount(count: number) {
        this.rawStats.set(StatField.VisibleChunksCount, count)
    }
    public updateWithTimeMeasurements(raw: Readonly<Float32Array>) {
        this.rawStats
            .edit()
            .set(StatField.DrawTime_HandleInputs, raw[DrawPhase.HandleInputs]!)
            .set(StatField.DrawTime_LockMutex, raw[DrawPhase.LockMutex]!)
            .set(StatField.DrawTime_UpdateWorld, raw[DrawPhase.UpdateWorld]!)
            .set(StatField.DrawTime_PrepareRender, raw[DrawPhase.PrepareRender]!)
            .set(StatField.DrawTime_GPUUpload, raw[DrawPhase.GPUUpload]!)
            .set(StatField.DrawTime_Draw, raw[DrawPhase.Draw]!)
            .set(StatField.DrawTime_DrawForMousePicker, raw[DrawPhase.DrawForMousePicker]!)
            .commit()
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