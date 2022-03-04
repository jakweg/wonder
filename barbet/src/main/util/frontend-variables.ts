import KeyboardController from '../keyboard-controller'
import { globalMutex } from '../worker/worker-global-state'
import { Lock } from './mutex'

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
	SIZE,
}


export let frontedVariablesBuffer: SharedArrayBuffer = new SharedArrayBuffer(0)
export let frontedVariables = new Int16Array(0)

export const initFrontedVariablesFromReceived = (buffer: SharedArrayBuffer) => {
	frontedVariablesBuffer = buffer
	frontedVariables = new Int16Array(buffer)
}

export const initFrontendVariableAndRegisterToWindow = () => {
	frontedVariablesBuffer = new SharedArrayBuffer(FrontendVariable.SIZE * Int16Array.BYTES_PER_ELEMENT)
	initFrontedVariablesFromReceived(frontedVariablesBuffer)


	KeyboardController.createNewAndRegisterToWindow(frontedVariables)
	const updateWindowFocus = () => {
		// noinspection JSIgnoredPromiseFromCall
		globalMutex.executeWithAcquiredAsync(Lock.FrontedVariables, () => {
			const hasFocus = document.hasFocus()
			if (hasFocus)
				frontedVariables[FrontendVariable.AdditionalFlags] |= AdditionalFrontedFlags.WindowHasFocus
			else
				frontedVariables[FrontendVariable.AdditionalFlags] &= ~AdditionalFrontedFlags.WindowHasFocus
		})
	}
	window.addEventListener('blur', updateWindowFocus)
	window.addEventListener('focus', updateWindowFocus)
	updateWindowFocus()
}

export const bindFrontendVariablesToCanvas = (canvas: HTMLCanvasElement) => {
	const defaultMouseListener = async (event: MouseEvent) => {
		event.preventDefault()
		await globalMutex.executeWithAcquiredAsync(Lock.FrontedVariables, () => {
			const isNowDown = event.type !== 'mouseup'
			const buttonAsFlag = event.button === 0 ? AdditionalFrontedFlags.LeftMouseButtonPressed : AdditionalFrontedFlags.RightMouseButtonPressed

			if (isNowDown)
				frontedVariables[FrontendVariable.AdditionalFlags] |= buttonAsFlag
			else {
				const newFlags = (frontedVariables[FrontendVariable.AdditionalFlags]! & ~AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight)
				frontedVariables[FrontendVariable.AdditionalFlags] = newFlags & ~buttonAsFlag | (buttonAsFlag === AdditionalFrontedFlags.RightMouseButtonPressed ? AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight : 0)
				frontedVariables[FrontendVariable.LastMouseClickId]++
			}

			frontedVariables[FrontendVariable.MouseCursorPositionX] = event.offsetX
			frontedVariables[FrontendVariable.MouseCursorPositionY] = 720 - event.offsetY
		})
	}
	const leaveListener = () => globalMutex.executeWithAcquiredAsync(Lock.FrontedVariables, () => {
		frontedVariables[FrontendVariable.AdditionalFlags] &= ~(AdditionalFrontedFlags.RightMouseButtonPressed | AdditionalFrontedFlags.LeftMouseButtonPressed)
	})

	canvas.addEventListener('mousedown', defaultMouseListener)
	canvas.addEventListener('mouseup', defaultMouseListener)
	canvas.addEventListener('contextmenu', defaultMouseListener)
	canvas.addEventListener('mouseleave', leaveListener, {passive: true})

	return () => {
		canvas.removeEventListener('mousedown', defaultMouseListener)
		canvas.removeEventListener('mouseup', defaultMouseListener)
		canvas.removeEventListener('contextmenu', defaultMouseListener)
		canvas.removeEventListener('mouseleave', leaveListener)
	}
}
