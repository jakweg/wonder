import { sleep } from '@seampan/util'
import { frontedVariables, FrontendVariable } from '../../util/frontend-variables'

const TEXTURE_PIXEL_MULTIPLIER = 1 / 4

export const enum MousePickableType {
  Nothing,
  Terrain,
  Unit,
}

export interface MousePickerNothingResult {
  pickedType: MousePickableType.Nothing
}

export interface MousePickerTerrainResult {
  pickedType: MousePickableType.Terrain
  x: number
  y: number
  z: number
  normals: [number, number, number]
}

export interface MousePickerUnitResult {
  pickedType: MousePickableType.Unit
  numericId: number
}

export type MousePickerResultAny = MousePickerTerrainResult | MousePickerUnitResult | MousePickerNothingResult

const createResultFromBuffer = (buffer: Readonly<Uint8Array>): MousePickerResultAny => {
  const type: MousePickableType = buffer[6]!
  switch (type) {
    case MousePickableType.Terrain: {
      const x = (buffer[0]! << 8) | buffer[1]!
      const z = (buffer[2]! << 8) | buffer[3]!
      const y = buffer[4]!

      const normals = buffer[5]! & 0b111111
      const nx = ((normals >> 4) & 0b11) - 1
      const ny = ((normals >> 2) & 0b11) - 1
      const nz = ((normals >> 0) & 0b11) - 1
      return {
        pickedType: MousePickableType.Terrain,
        x,
        y,
        z,
        normals: [nx, ny, nz],
      }
    }
    case MousePickableType.Unit:
      const unitId = (buffer[0]! << 16) | (buffer[1]! << 8) | buffer[2]!
      return {
        pickedType: MousePickableType.Unit,
        numericId: unitId,
      }
    case MousePickableType.Nothing:
    default:
      return { pickedType: MousePickableType.Nothing }
  }
}

export const newMousePicker = (gl: WebGL2RenderingContext) => {
  let textureWidth = -1
  let textureHeight = -1
  let fb: WebGLFramebuffer | null = null
  let texture0: WebGLTexture | null = null
  let texture1: WebGLTexture | null = null
  let isWaitingForRead = false
  const readPixelsBuffer = new Uint8Array(8)
  const asyncGpuBufferToRead = gl.createBuffer()
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, asyncGpuBufferToRead)
  gl.bufferData(gl.PIXEL_PACK_BUFFER, readPixelsBuffer.byteLength, gl.STREAM_READ)
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

  const preparePickerIfNeeded = () => {
    const width = (Atomics.load(frontedVariables, FrontendVariable.CanvasDrawingWidth) * TEXTURE_PIXEL_MULTIPLIER) | 0
    const height = (Atomics.load(frontedVariables, FrontendVariable.CanvasDrawingHeight) * TEXTURE_PIXEL_MULTIPLIER) | 0

    if (width === textureWidth && height === textureHeight && fb !== null) return

    textureWidth = width
    textureHeight = height

    if (fb !== null) gl.deleteFramebuffer(fb)
    if (texture0 !== null) gl.deleteTexture(texture0)
    if (texture1 !== null) gl.deleteTexture(texture1)

    fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)

    texture0 = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture0)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture0, 0)

    texture1 = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture1)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, textureWidth, textureHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texture1, 0)

    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('invalid framebuffer status', status)
      textureWidth = textureHeight = -1
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  return {
    canPickNow() {
      return !isWaitingForRead
    },
    prepareBeforeDraw() {
      preparePickerIfNeeded()
      if (textureWidth < 0) return

      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.viewport(0, 0, textureWidth, textureHeight)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    },
    pickAfterDraw(mouseX: number, mouseY: number): Promise<MousePickerResultAny> | null {
      if (textureWidth < 0) return null
      if (isWaitingForRead) return null
      isWaitingForRead = true

      const pixelX = (mouseX * TEXTURE_PIXEL_MULTIPLIER) | 0
      const pixelY = (mouseY * TEXTURE_PIXEL_MULTIPLIER) | 0

      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, asyncGpuBufferToRead)
      gl.readBuffer(gl.COLOR_ATTACHMENT0)
      gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0)
      gl.readBuffer(gl.COLOR_ATTACHMENT1)
      gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 4)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!
      gl['flush']()

      return Promise.resolve().then(async () => {
        try {
          while (true) {
            await sleep(4)
            const waitResult = gl.clientWaitSync(sync, 0, 0)

            if (waitResult === gl.WAIT_FAILED) return { pickedType: MousePickableType.Nothing }

            if (waitResult === gl.TIMEOUT_EXPIRED) continue // still processing

            break // status is other - processing finished
          }
        } finally {
          isWaitingForRead = false
          gl.deleteSync(sync)
        }

        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, asyncGpuBufferToRead)
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, readPixelsBuffer, 0, 8)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

        return createResultFromBuffer(readPixelsBuffer)
      })
    },
  }
}
