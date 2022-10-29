export const enum DrawPhase {
    HandleInputs,
    LockMutex,
    UpdateWorld,
    PrepareRender,
    GPUUpload,
    Draw,
    DrawForMousePicker,
    SIZE,
}

interface MeasurementType {
    intervalMilliseconds: number
    isSum: boolean
}

export const REQUESTED_MEASUREMENTS: MeasurementType[] = [
    { intervalMilliseconds: 300, isSum: true },
    { intervalMilliseconds: 2_000, isSum: true },
    { intervalMilliseconds: 10_000, isSum: true },
]