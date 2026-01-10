export const enum DrawPhase {
  LockMutex,
  UpdateWorld,
  GPUUpload,
  Draw,
  /** @deprecated */
  PrepareRender,
  /** @deprecated */
  HandleInputs,
  /** @deprecated */
  DrawForMousePicker,
  SIZE,
}
