import { createNewBuffer } from './shared-memory'

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
	AdditionalFlags,
	LastMouseClickId,
	CanvasDrawingWidth,
	CanvasDrawingHeight,
	SIZE,
}


export let frontedVariablesBuffer: SharedArrayBuffer = createNewBuffer(0)
export let frontedVariables = new Int16Array(0)
export const setFrontendVariables = (buffer: SharedArrayBuffer, variables: Int16Array) => {
	frontedVariablesBuffer = buffer
	frontedVariables = variables
}

