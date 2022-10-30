
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

