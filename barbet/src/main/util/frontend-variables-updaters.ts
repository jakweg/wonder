import KeyboardController from '@utils/keyboard-controller'
import { UICanvas } from 'src/main/ui/canvas-background'
import { FrontendVariable } from './frontend-variables'

function observeCanvasSize(canvas: HTMLCanvasElement, frontendVariables: Int16Array) {
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

type DragMode = null | 'orbit' | 'pan'

const DRAG_THRESHOLD_PX = 5
const WHEEL_LINEAR_KNEE = 24
const WHEEL_EXCESS_SCALE = 0.3
const WHEEL_EVENT_MAX_DELTA = 60

const handlePointerEvents = (canvas: HTMLCanvasElement, frontendVariables: Int16Array) => {
  const abortController = new AbortController()
  const signal = abortController['signal']

  canvas.addEventListener('contextmenu', e => e.preventDefault(), { 'signal': signal })

  const updateMousePosition = (x: number, y: number) => {
    Atomics.store(frontendVariables, FrontendVariable.MouseCursorPositionX, Math.round(x))
    Atomics.store(frontendVariables, FrontendVariable.MouseCursorPositionY, Math.round(y))
  }

  let dragPointerId = -1
  let downStartX = -1
  let downStartY = -1
  let lastX = -1
  let lastY = -1
  let dragMode: DragMode = null
  let dragCloseEnoughForClick = false

  const resetDrag = () => {
    dragPointerId = -1
    dragMode = null
    dragCloseEnoughForClick = false
    canvas['classList']['remove']('_css_cursor_grabbing', '_css_cursor_move')
  }

  canvas.addEventListener(
    'pointerdown',
    function (event) {
      const pointerId = event['pointerId']
      if (dragPointerId !== -1) return
      this['setPointerCapture'](pointerId)
      dragPointerId = pointerId

      const isMetaPressed = event['metaKey']
      const isAltPressed = event['altKey']

      dragMode = null
      if (isMetaPressed && !isAltPressed) dragMode = 'pan'
      if (!isMetaPressed && isAltPressed) dragMode = 'orbit'

      const devicePixelRatio = window['devicePixelRatio']
      lastX = downStartX = event['offsetX'] * devicePixelRatio
      lastY = downStartY = event['offsetY'] * devicePixelRatio
      dragCloseEnoughForClick = true
      updateMousePosition(downStartX, downStartY)
    },
    { 'signal': signal },
  )

  canvas.addEventListener(
    'pointerup',
    function (event) {
      const pointerId = event['pointerId']
      if (pointerId !== dragPointerId) return

      const devicePixelRatio = window['devicePixelRatio']
      const x = event['offsetX'] * devicePixelRatio
      const y = event['offsetY'] * devicePixelRatio
      updateMousePosition(x, y)
      if (dragCloseEnoughForClick) {
        // TODO: trigger click pick
      }
      resetDrag()
    },
    { 'signal': signal },
  )

  canvas.addEventListener(
    'pointermove',
    function (event) {
      const pointerId = event['pointerId']
      const devicePixelRatio = window['devicePixelRatio']
      const x = event['offsetX'] * devicePixelRatio
      const y = event['offsetY'] * devicePixelRatio
      if (dragPointerId === -1) {
        updateMousePosition(x, y)
        return
      }
      if (pointerId !== dragPointerId) return

      const threshold = DRAG_THRESHOLD_PX * devicePixelRatio
      dragCloseEnoughForClick &&= (downStartX - x) ** 2 + (downStartY - y) ** 2 < threshold ** 2

      if (!dragCloseEnoughForClick) {
        if (dragMode === 'orbit') {
          canvas['classList']['add']('_css_cursor_grabbing')
          Atomics.add(frontendVariables, FrontendVariable.CameraOrbitDeltaX8, Math.round((x - lastX) * 8))
          Atomics.add(frontendVariables, FrontendVariable.CameraOrbitDeltaY8, Math.round((y - lastY) * 8))
        } else if (dragMode === 'pan') {
          canvas['classList']['add']('_css_cursor_move')
          Atomics.add(frontendVariables, FrontendVariable.CameraPanDeltaX8, Math.round((x - lastX) * 8))
          Atomics.add(frontendVariables, FrontendVariable.CameraPanDeltaY8, Math.round((y - lastY) * 8))
        }
      }

      lastX = x
      lastY = y
    },
    { 'passive': true, 'signal': signal },
  )

  canvas.addEventListener(
    'pointercancel',
    function (event) {
      if (event['pointerId'] !== dragPointerId) return
      resetDrag()
      updateMousePosition(-1, -1)
    },
    { 'signal': signal },
  )

  canvas.addEventListener(
    'lostpointercapture',
    function (event) {
      if (event['pointerId'] !== dragPointerId) return
      resetDrag()
    },
    { 'signal': signal },
  )

  canvas.addEventListener(
    'pointerleave',
    function () {
      if (dragPointerId !== -1) return
      updateMousePosition(-1, -1)
    },
    { 'passive': true, 'signal': signal },
  )

  canvas.addEventListener(
    'wheel',
    function (event) {
      event.preventDefault()
      let deltaY = event['deltaY']
      const deltaMode = event['deltaMode']
      if (deltaMode === 1) deltaY *= 33
      else if (deltaMode === 2) deltaY *= 120

      // Touchpads emit many small pixel deltas; notched mouse wheels emit large spikes (100..300+).
      // Keep small deltas linear for smooth touchpad control and compress large per-event spikes.
      const absDelta = Math.abs(deltaY)
      const compressed =
        absDelta <= WHEEL_LINEAR_KNEE
          ? absDelta
          : WHEEL_LINEAR_KNEE + (absDelta - WHEEL_LINEAR_KNEE) * WHEEL_EXCESS_SCALE
      const clamped = Math.min(compressed, WHEEL_EVENT_MAX_DELTA)
      Atomics.add(frontendVariables, FrontendVariable.MouseWheelDelta, Math.round(Math.sign(deltaY) * clamped))
    },
    { 'passive': false, 'signal': signal },
  )

  return () => {
    resetDrag()
    abortController['abort']()
  }
}

export const bindFrontendVariablesToCanvas = ({ element: canvas, frontendVariables }: UICanvas) => {
  const unobservePointer = handlePointerEvents(canvas, frontendVariables)
  const unobserveCanvasSize = observeCanvasSize(canvas, frontendVariables)
  const unobserveKeyboard = KeyboardController.INSTANCE?.addFrontendVariableListener(frontendVariables)

  return () => {
    unobservePointer()
    unobserveCanvasSize()
    unobserveKeyboard?.()
  }
}
