import IndexedState from "../../state/indexed-state"

export const enum StatField {
    GameLoadTimeMs,
}

export const newStatsObject = () => IndexedState.fromObject({
    [StatField.GameLoadTimeMs]: 0,
})

export type UpdateDebugStats = ReturnType<typeof newStatsObject>

export class UpdateDebugDataCollector {

    private readonly rawStats = newStatsObject()
    private observingEnabled: boolean = false
    private receiveUpdatesCancelCallback: any = null
    public constructor() {
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