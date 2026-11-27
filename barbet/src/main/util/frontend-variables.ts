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
}

export const enum FrontendVariable {
  PressedKeys,
  MouseCursorPositionX,
  MouseCursorPositionY,
  MouseWheelDelta,
  /** Delta multiplied by 8 */
  CameraOrbitDeltaX8,
  /** Delta multiplied by 8 */
  CameraOrbitDeltaY8,
  /** Delta multiplied by 8 */
  CameraPanDeltaX8,
  /** Delta multiplied by 8 */
  CameraPanDeltaY8,
  AdditionalFlags,
  CanvasDrawingWidth,
  CanvasDrawingHeight,
  SIZE,
}
