import { AsyncEntityIdReader } from '@3d/pipeline/async-entity-id-reader'
import { createNewMouseInterpreter } from '@3d/pipeline/mouse-interpreter'
import { TextureSlot } from '@3d/texture-slot-counter'
import { GameState } from '@game'
import { ScheduledActionId } from '@game/scheduled-actions'
import { ActionsQueue } from '@game/scheduled-actions/queue'
import { sleep } from '@seampan/util'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '@utils/frontend-variables'
import CONFIG, { observeSetting } from '@utils/persistence/observable-settings'
import { UICanvas } from 'src/main/ui/canvas-background'
import { Camera } from '../camera'
import { MousePickerResultAny } from './mouse-picker'

const obtainWebGl2ContextFromCanvas = (canvas: HTMLCanvasElement | OffscreenCanvas): WebGL2RenderingContext => {
  const context = canvas.getContext('webgl2', {
    'alpha': false,
    'antialias': false,
    'depth': true,
    'stencil': false,
    'failIfMajorPerformanceCaveat': true,
    'powerPreference': CONFIG.get('rendering/power-preference'),
  }) as WebGL2RenderingContext
  if (context == null) throw new Error('Unable to obtain context')
  return context
}

const obtainRendererNameFromContext = (gl: WebGL2RenderingContext | undefined): string | null => {
  if (gl) {
    const ext = gl['getExtension']('WEBGL_debug_renderer_info') as any
    if (ext) {
      const value = gl['getParameter'](ext['UNMASKED_RENDERER_WEBGL'])
      if (value) return `${value}`
    }
  }
  return null
}

interface RenderingState {
  resolveFbo: WebGLFramebuffer
  colorTexture: WebGLTexture
  entityIdTexture: WebGLTexture
  depthBuffer: WebGLRenderbuffer

  fullscreenProgram: WebGLProgram
  screenTextureUniform: WebGLUniformLocation
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(vertexShader, vsSource)
  gl.compileShader(vertexShader)

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(fragmentShader, fsSource)
  gl.compileShader(fragmentShader)

  const program = gl.createProgram()!
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  return program
}

function initializeRendering(gl: WebGL2RenderingContext): RenderingState {
  const resolveFbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo)

  const colorTexture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.DisplayFinalization)
  gl.bindTexture(gl.TEXTURE_2D, colorTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0)

  const entityIdTexture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.EntityId)
  gl.bindTexture(gl.TEXTURE_2D, entityIdTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, 1, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, entityIdTexture, 0)

  const depthBuffer = gl.createRenderbuffer()!
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 1, 1)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)

  const vs = `#version 300 es
        out vec2 v_uv;
        void main() {
            float u = float((gl_VertexID << 1) & 2);
            float v = float(gl_VertexID & 2);
            v_uv = vec2(u, v);
            gl_Position = vec4(u * 2.0 - 1.0, v * 2.0 - 1.0, 0.0, 1.0);
        }`
  const fs = `#version 300 es
        precision mediump float;
        uniform sampler2D u_screenTexture;
        in vec2 v_uv;
        out vec4 outColor;
        void main() {
            outColor = texture(u_screenTexture, v_uv);
        }`

  const fullscreenProgram = createProgram(gl, vs, fs)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  const screenTextureUniform = gl.getUniformLocation(fullscreenProgram, 'u_screenTexture')!

  return {
    resolveFbo,
    colorTexture,
    entityIdTexture,
    depthBuffer,
    fullscreenProgram,
    screenTextureUniform,
  }
}

function handleResize(gl: WebGL2RenderingContext, state: RenderingState, newWidth: number, newHeight: number) {
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.DisplayFinalization)
  gl.bindTexture(gl.TEXTURE_2D, state.colorTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, newWidth, newHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.EntityId)
  gl.bindTexture(gl.TEXTURE_2D, state.entityIdTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, newWidth, newHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, null)
  gl.bindRenderbuffer(gl.RENDERBUFFER, state.depthBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, newWidth, newHeight)

  gl.activeTexture(gl.TEXTURE0 + TextureSlot.UNUSED)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindRenderbuffer(gl.RENDERBUFFER, null)
}

function prepareForDraw(gl: WebGL2RenderingContext, state: RenderingState) {
  const fbo = state.resolveFbo
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  gl.clearBufferfv(gl.COLOR, 0, [0.1, 0.2, 0.3, 1.0]) // Clear color to dark blue
  gl.clearBufferuiv(gl.COLOR, 1, [0, 0, 0, 0]) // Clear ID to 0
  gl.clear(gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST)
  // gl.disable(gl.CULL_FACE)
  gl.enable(gl.CULL_FACE)
  gl.cullFace(gl.BACK)
}

function finalizeDisplay(gl: WebGL2RenderingContext, state: RenderingState) {
  // Draw the final color texture to the screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.useProgram(state.fullscreenProgram)
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.DisplayFinalization)
  gl.bindTexture(gl.TEXTURE_2D, state.colorTexture)
  gl.uniform1i(state.screenTextureUniform, TextureSlot.DisplayFinalization)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

export const newContextWrapper = async ({ element: canvas, frontendVariables }: UICanvas, camera: Camera) => {
  const gl = obtainWebGl2ContextFromCanvas(canvas)
  const state = initializeRendering(gl)
  const entityIdReader = new AsyncEntityIdReader(gl)
  const mouse = createNewMouseInterpreter()

  let lastWidth = -1
  let lastHeight = -1

  return {
    rawContext: gl,
    getRendererName() {
      return obtainRendererNameFromContext(gl) ?? '<unknown renderer>'
    },
    prepareForDraw() {
      const width = frontendVariables[FrontendVariable.CanvasDrawingWidth]
      const height = frontendVariables[FrontendVariable.CanvasDrawingHeight]

      const pixelMultiplier = 1.0

      const TEXTURE_PIXEL_MULTIPLIER = 1 / pixelMultiplier

      if (lastWidth !== width || lastHeight !== height) {
        camera.setAspectRatio(width / height)
        lastWidth = width
        lastHeight = height

        canvas['width'] = (width * TEXTURE_PIXEL_MULTIPLIER) | 0
        canvas['height'] = (height * TEXTURE_PIXEL_MULTIPLIER) | 0

        handleResize(gl, state, (width * TEXTURE_PIXEL_MULTIPLIER) | 0, (height * TEXTURE_PIXEL_MULTIPLIER) | 0)
      }

      prepareForDraw(gl, state)
    },
    updateCameraWithMutexHeld(dt: number, game: GameState, terrainHeight: number) {
      mouse.updateCameraBasedOnInputsWithMutexHeld(camera, frontendVariables, game, terrainHeight, dt)
    },
    finalizeDisplay(dt: number) {
      if (entityIdReader.canRead()) {
        const x = frontendVariables[FrontendVariable.MouseCursorPositionX]
        const y = frontendVariables[FrontendVariable.MouseCursorPositionY]
        if (x >= 0 && y >= 0) {
          entityIdReader.readEntityId(x, y)?.then(entityId => {
            let blockX = -1
            let blockZ = -1
            if (entityId !== 0) {
              const isBlock = entityId >>> 31 === 1
              if (!isBlock) {
                console.log('not a block', { entityId })
                return
              }
              const posMask = 0xffff >> 2
              blockZ = entityId & posMask
              blockX = (entityId >> 14) & posMask
            }
            // console.log({ x, y, entityId, blockX, blockZ })
          })
        }
      }
      finalizeDisplay(gl, state)
    },
  }
}

/** @deprecated will be removed soon TODO */
export const newBeforeDrawWrapper = (canvas: HTMLCanvasElement, camera: Camera) => {
  const gl = obtainWebGl2ContextFromCanvas(canvas)

  const TEXTURE_PIXEL_MULTIPLIER = 1 / 1

  let lastWidth = -1
  let lastHeight = -1

  return {
    rawContext: gl,
    getRendererName() {
      return obtainRendererNameFromContext(gl) ?? ''
    },
    handleResize() {
      const width = frontedVariables[FrontendVariable.CanvasDrawingWidth]!
      const height = frontedVariables[FrontendVariable.CanvasDrawingHeight]!
      if (lastWidth !== width || lastHeight !== height) {
        camera.setAspectRatio(width / height)
        lastWidth = width
        lastHeight = height

        canvas['width'] = (width * TEXTURE_PIXEL_MULTIPLIER) | 0
        canvas['height'] = (height * TEXTURE_PIXEL_MULTIPLIER) | 0
      }
      gl.viewport(0, 0, (width * TEXTURE_PIXEL_MULTIPLIER) | 0, (height * TEXTURE_PIXEL_MULTIPLIER) | 0)
    },
    clearBeforeDraw() {
      gl.clearColor(0.15, 0.15, 0.15, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)

      gl.cullFace(gl.BACK)
      gl.enable(gl.CULL_FACE)
    },
  }
}

export const newFramesLimiter = (frontendVariables: UICanvas['frontendVariables']) => {
  let minSecondsBetweenFramesFocus = 0
  let minSecondsBetweenFramesBlur = 0

  const unsub1 = observeSetting('rendering/fps-cap', value => {
    minSecondsBetweenFramesFocus = value <= 0 ? 0 : 1 / (+value <= 0 ? 0.00001 : +value)
  })
  const unsub2 = observeSetting('rendering/fps-cap-on-blur', value => {
    minSecondsBetweenFramesBlur = value <= 0 ? 9999999 : 1 / +value
  })

  return {
    shouldRender: (dt: number): boolean => {
      const variables = Atomics.load(frontendVariables as any as Int16Array, FrontendVariable.AdditionalFlags)
      const hasFocus = (variables & AdditionalFrontedFlags.WindowHasFocus) === AdditionalFrontedFlags.WindowHasFocus
      return dt >= (hasFocus ? minSecondsBetweenFramesFocus : minSecondsBetweenFramesBlur) * 0.97
    },
    cleanUp() {
      unsub1()
      unsub2()
    },
  }
}

export const waitForAllGPUOperationsToFinish = async (gl: WebGL2RenderingContext) => {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!
  gl['flush']()

  try {
    while (true) {
      await sleep(4)
      const waitResult = gl.clientWaitSync(sync, 0, 0)

      if (waitResult === gl.WAIT_FAILED) return

      if (waitResult === gl.TIMEOUT_EXPIRED) continue // still processing

      break // status is other - processing finished
    }
  } finally {
    gl.deleteSync(sync)
  }
}

export const newAnimationFrameCaller = (
  shouldRender: (elapsedSeconds: number) => boolean,
  actualRender: (elapsedSeconds: number, secondsSinceFirstRender: number) => Promise<void>,
) => {
  let nextFrameRequest = 0
  let firstFrameTime = 0
  let lastFrameTime = 0

  const internalRenderFunction = async () => {
    const now = performance.now()
    const elapsedSeconds = (now - lastFrameTime) / 1000

    if (shouldRender(elapsedSeconds) === true) {
      await actualRender(elapsedSeconds, (now - firstFrameTime) / 1000)
      lastFrameTime = now
    }

    // someone could cancel rendering in render callback
    if (nextFrameRequest !== 0) nextFrameRequest = requestAnimationFrame(internalRenderFunction)
  }

  return {
    start() {
      if (nextFrameRequest !== 0) return

      firstFrameTime = lastFrameTime = performance.now()

      nextFrameRequest = requestAnimationFrame(internalRenderFunction)
    },
    stop() {
      // safari doesn't support - check before call
      if (!!globalThis.cancelAnimationFrame) cancelAnimationFrame(nextFrameRequest)
      nextFrameRequest = 0
    },
  }
}

const enum EventHappened {
  None,
  LeftClick,
  RightClick,
}

interface InputHandlerRequestForRender {
  mouseX: number
  mouseY: number
  event: EventHappened
}

export const newInputHandler = (actionsQueue: ActionsQueue) => {
  let lastClickId: number = 0
  let mousePositionX: number = 0
  let mousePositionY: number = 0

  return {
    handleInputsBeforeDraw(camera: Camera, dt: number) {
      console.log('would call moveCameraByKeys')
      // moveCameraByKeys(camera, frontedVariables as any, dt)
    },
    shouldRenderForInputs(): InputHandlerRequestForRender | null {
      let eventHappened: EventHappened = EventHappened.None

      if (lastClickId !== frontedVariables[FrontendVariable.LastMouseClickId]) {
        lastClickId = frontedVariables[FrontendVariable.LastMouseClickId]!
        mousePositionX = frontedVariables[FrontendVariable.MouseCursorPositionX]!
        mousePositionY =
          frontedVariables[FrontendVariable.CanvasDrawingHeight]! -
          frontedVariables[FrontendVariable.MouseCursorPositionY]!
        const right =
          (frontedVariables[FrontendVariable.AdditionalFlags]! &
            AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight) ===
          AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight
        eventHappened = right ? EventHappened.RightClick : EventHappened.LeftClick
      }

      if (eventHappened === EventHappened.None) return null

      return {
        mouseX: mousePositionX,
        mouseY: mousePositionY,
        event: eventHappened,
      }
    },
    interpretPick(computed: MousePickerResultAny, event: InputHandlerRequestForRender) {
      actionsQueue.append({
        type: ScheduledActionId.MouseClick,
        pick: computed,
        wasLeftClick: event.event === EventHappened.LeftClick,
      })
    },
  }
}
