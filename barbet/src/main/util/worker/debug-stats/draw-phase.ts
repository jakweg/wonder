import { MeasurementType } from "../../../ui/debug-info";

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


export const REQUESTED_MEASUREMENTS: MeasurementType[] = [
    { intervalMilliseconds: 1000, isSum: true },
    { intervalMilliseconds: 5_000, isSum: false },
    { intervalMilliseconds: 10_000, isSum: true },
]