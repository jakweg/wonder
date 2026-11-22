import { waitForAllGPUOperationsToFinish } from '@3d/pipeline/wrappers'

export class AsyncEntityIdReader {
  private isWaitingForRead = false
  private asyncGpuBufferToRead: WebGLBuffer
  private readPixelsBuffer = new Uint32Array(4)
  constructor(private readonly gl: WebGL2RenderingContext) {
    this.asyncGpuBufferToRead = gl.createBuffer()
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.asyncGpuBufferToRead)
    // Use DYNAMIC_DRAW instead of STREAM_READ to avoid a Chromium ReadbackBufferShadowTracker bug
    // that emits false-positive performance warnings when reusing READ-usage PBOs across fenced readbacks.
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
  }

  canRead() {
    return !this.isWaitingForRead
  }

  readEntityId(pixelX: number, pixelY: number): Promise<number> | null {
    if (this.isWaitingForRead) return null
    this.isWaitingForRead = true

    const gl = this.gl
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.asyncGpuBufferToRead)
    gl.readBuffer(gl.COLOR_ATTACHMENT1)
    gl.readPixels(pixelX, gl['canvas']['height'] - 1 - pixelY, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_INT, 0)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

    return waitForAllGPUOperationsToFinish(gl)
      .then(async () => {
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.asyncGpuBufferToRead)
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.readPixelsBuffer, 0, 1)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

        return this.readPixelsBuffer[0]!
      })
      .finally(() => (this.isWaitingForRead = false))
  }
}
