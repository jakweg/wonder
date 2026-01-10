import KeyboardController from '@utils/keyboard-controller'
import { UICanvas } from 'src/main/ui/canvas-background'
import { AdditionalFrontedFlags, FrontendVariable } from './frontend-variables'

function observeCanvasSize(canvas: HTMLCanvasElement, frontendVariables: Int16Array, aferResize: () => void) {
  let timeoutId: number = 0
  let frameId: number = 0
  const lastSizes = { lastResizeTime: 0, width: 0, height: 0, pixelRatio: 0 }
  const checkSizesCallback = () => {
    const width = canvas['clientWidth']
    const height = canvas['clientHeight']
    const pixelRatio = window['devicePixelRatio']
    if (width === lastSizes.width && height === lastSizes.height && pixelRatio === lastSizes.pixelRatio) {
      const timeSinceLastResize = performance.now() - lastSizes.lastResizeTime
      const nextCheckTimeout = timeSinceLastResize > 20_000 ? 10_000 : timeSinceLastResize * 0.5
      timeoutId = setTimeout(() => (frameId = requestAnimationFrame(checkSizesCallback)), nextCheckTimeout)
      return
    }

    lastSizes.width = width
    lastSizes.height = height
    lastSizes.pixelRatio = pixelRatio
    lastSizes.lastResizeTime = performance.now()
    if (width === 0 || height === 0) return

    Atomics.store(frontendVariables, FrontendVariable.CanvasDrawingWidth, Math.round(width * pixelRatio))
    Atomics.store(frontendVariables, FrontendVariable.CanvasDrawingHeight, Math.round(height * pixelRatio))
    if (frameId !== -1) frameId = requestAnimationFrame(checkSizesCallback)
  }
  checkSizesCallback()
  const resizeCallback = () => {
    if (frameId !== -1 && lastSizes.lastResizeTime + 50 < performance.now()) {
      clearTimeout(timeoutId)
      cancelAnimationFrame(frameId)
      checkSizesCallback()
    }
  }
  window.addEventListener('resize', resizeCallback, { 'passive': true })
  return () => {
    frameId = -1
    clearTimeout(timeoutId)
    cancelAnimationFrame(frameId)
    window.removeEventListener('resize', resizeCallback)
  }
}

export const bindFrontendVariablesToCanvas = ({ element: canvas, frontendVariables: rawVars }: UICanvas) => {
  const frontendVariables = rawVars as any as Int16Array

  const mouseMoveListener = (event: MouseEvent) => {
    Atomics.store(
      frontendVariables,
      FrontendVariable.MouseCursorPositionX,
      event['offsetX'] * window['devicePixelRatio'],
    )
    Atomics.store(
      frontendVariables,
      FrontendVariable.MouseCursorPositionY,
      event['offsetY'] * window['devicePixelRatio'],
    )
  }

  const defaultMouseListener = (event: MouseEvent) => {
    event.preventDefault()
    const isNowDown = event['type'] !== 'mouseup'
    const buttonAsFlag =
      event['button'] === 0
        ? AdditionalFrontedFlags.LeftMouseButtonPressed
        : AdditionalFrontedFlags.RightMouseButtonPressed

    if (isNowDown) frontendVariables[FrontendVariable.AdditionalFlags]! |= buttonAsFlag
    else {
      const newFlags =
        Atomics.load(frontendVariables, FrontendVariable.AdditionalFlags) &
        ~AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight
      Atomics.store(
        frontendVariables,
        FrontendVariable.AdditionalFlags,
        (newFlags & ~buttonAsFlag) |
          (buttonAsFlag === AdditionalFrontedFlags.RightMouseButtonPressed
            ? AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight
            : 0),
      )
      Atomics.add(frontendVariables, FrontendVariable.LastMouseClickId, 1)
    }

    Atomics.store(
      frontendVariables,
      FrontendVariable.MouseCursorPositionX,
      event['offsetX'] * window['devicePixelRatio'],
    )
    Atomics.store(
      frontendVariables,
      FrontendVariable.MouseCursorPositionY,
      event['offsetY'] * window['devicePixelRatio'],
    )
  }

  const wheelListener = (event: WheelEvent) => {
    const rawDelta = event['deltaY']
    Atomics.store(frontendVariables, FrontendVariable.MouseWheelDelta, rawDelta | 0)
  }

  const leaveListener = () => {
    Atomics.and(
      frontendVariables,
      FrontendVariable.AdditionalFlags,
      ~(AdditionalFrontedFlags.RightMouseButtonPressed | AdditionalFrontedFlags.LeftMouseButtonPressed),
    )
    Atomics.store(frontendVariables, FrontendVariable.MouseCursorPositionX, -1)
    Atomics.store(frontendVariables, FrontendVariable.MouseCursorPositionY, -1)
    Atomics.store(frontendVariables, FrontendVariable.MouseWheelDelta, 0)
  }

  const unobserveCanvasSize = observeCanvasSize(canvas, frontendVariables, leaveListener)

  canvas.addEventListener('mousemove', mouseMoveListener, { 'passive': true })
  canvas.addEventListener('mousedown', defaultMouseListener)
  canvas.addEventListener('mouseup', defaultMouseListener)
  canvas.addEventListener('contextmenu', defaultMouseListener)
  canvas.addEventListener('wheel', wheelListener, { 'passive': true })
  canvas.addEventListener('mouseleave', leaveListener, { 'passive': true })

  const unobserveKeyboard = KeyboardController.INSTANCE?.addFrontendVariableListener(frontendVariables)
  return () => {
    unobserveCanvasSize()
    unobserveKeyboard?.()
    canvas.removeEventListener('mousemove', mouseMoveListener)
    canvas.removeEventListener('mousedown', defaultMouseListener)
    canvas.removeEventListener('mouseup', defaultMouseListener)
    canvas.removeEventListener('contextmenu', defaultMouseListener)
    canvas.removeEventListener('wheel', wheelListener)
    canvas.removeEventListener('mouseleave', leaveListener)
  }
}
