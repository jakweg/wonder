import IndexedState from "../../state/indexed-state"

export const enum StatFields {
    RendererName,
    DrawCallsCount,
}

export const newStatsObject = () => IndexedState.fromObject({
    [StatFields.RendererName]: '?' as string,
    [StatFields.DrawCallsCount]: 0 as number,
})

export type RenderDebugStats = ReturnType<typeof newStatsObject>

export class RenderDebugDataCollector {

    private readonly rawStats = newStatsObject()
    private observingEnabled: boolean = false
    private receiveUpdatesCancelCallback: any = null
    public constructor() {
    }

    public setRendererName(name: string) {
        this.rawStats.set(StatFields.RendererName, name || '?')
    }

    public incrementDrawCalls() {
        this.rawStats.set(StatFields.DrawCallsCount, this.rawStats.get(StatFields.DrawCallsCount) + 1)
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