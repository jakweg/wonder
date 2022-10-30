export const enum UpdatePhase {
    LockMutex,
    UpdateWorld,
    SIZE,
}

interface MeasurementType {
    intervalMilliseconds: number
    isSum: boolean
}

export const REQUESTED_MEASUREMENTS: MeasurementType[] = [
    { intervalMilliseconds: 1000, isSum: true },
    { intervalMilliseconds: 5_000, isSum: false },
    { intervalMilliseconds: 10_000, isSum: true },
]