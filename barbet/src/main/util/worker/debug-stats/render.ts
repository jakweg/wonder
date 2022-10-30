import IndexedState from "../../state/indexed-state"

export const enum StatField {
    RendererName,
    DrawCallsCount,
    VisibleChunksCount,
    DrawTimesBuffer,
}

export const newStatsObject = () => IndexedState.fromObject({
    [StatField.RendererName]: '?' as string,
    [StatField.DrawCallsCount]: 0 as number,
    [StatField.VisibleChunksCount]: 0 as number,
    [StatField.DrawTimesBuffer]: new ArrayBuffer(0),
})

export type RenderDebugStats = ReturnType<typeof newStatsObject>

export class RenderDebugDataCollector {

    private readonly rawStats = newStatsObject()
    private frameSamples: Float32Array
    private currentFrameSample: number = 0
    private frameStart: number = 0
    private observingEnabled: boolean = false
    private receiveUpdatesCancelCallback: any = null
    public constructor(private readonly frameSamplesCount: number) {
        this.frameSamples = new Float32Array(frameSamplesCount + 1)
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
    public updateWithTimeMeasurements(raw: Readonly<ArrayBuffer>) {
        this.rawStats
            .edit()
            .set(StatField.DrawTimesBuffer, raw)
            .commit()
    }

    public frameStarted(): void {
        this.frameStart = performance['now']()
    }
    public frameEnded(): void {
        const duration = performance['now']() - this.frameStart
        if (++this.currentFrameSample === this.frameSamplesCount)
            this.currentFrameSample = 0
        this.frameSamples[this.currentFrameSample + 1] = duration
        this.frameSamples[0] = this.currentFrameSample
    }

    public getFrameTimeRaw(): Readonly<Float32Array> {
        return this.frameSamples
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