export const enum PressedKey {
  None = 0,
  Left = 1 << 1,
  Right = 1 << 2,
  Forward = 1 << 3,
  Backward = 1 << 4,
  Up = 1 << 5,
  Down = 1 << 6,
}

export const enum AdditionalFrontedFlags {
  WindowHasFocus = 1 << 0,
  LeftMouseButtonPressed = 1 << 1,
  RightMouseButtonPressed = 1 << 2,
  LastMouseButtonUnpressedWasRight = 1 << 3,
}

export const enum FrontendVariable {
  PressedKeys,
  MouseCursorPositionX,
  MouseCursorPositionY,
  MouseWheelDelta,
  AdditionalFlags,
  LastMouseClickId,
  CanvasDrawingWidth,
  CanvasDrawingHeight,
  SIZE,
}

/** @deprecated This array is now always zero. It's not longer usage. */
export let frontedVariables = new Int16Array(0)
