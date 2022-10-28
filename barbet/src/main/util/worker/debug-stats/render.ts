import IndexedState from "../../state/indexed-state"

export const enum StatField {
    RendererName,
    DrawCallsCount,
}

export const newStatsObject = () => IndexedState.fromObject({
    [StatField.RendererName]: '?' as string,
    [StatField.DrawCallsCount]: 0 as number,
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

    public receiveUpdates(callback: (stats: any) => void) {
        if (this.observingEnabled) throw new Error()
        this.receiveUpdatesCancelCallback = this.rawStats.observeEverything(s => callback(s))
    }

    public stopUpdates() {
        this.observingEnabled = false
        this.receiveUpdatesCancelCallback?.()
    }
}