import { createNewBuffer } from '../../shared-memory'

export class FramesMeter {
  private frameSamples: Float32Array
  private currentFrameSample: number = 0
  private frameStart: number = 0

  public constructor(private readonly frameSamplesCount: number) {
    this.frameSamples = new Float32Array(createNewBuffer((frameSamplesCount * 2 + 1) * Float32Array.BYTES_PER_ELEMENT))
  }

  public frameStarted(): void {
    this.frameStart = performance['now']()
  }
  public frameEnded(trueSleepTime: number): void {
    const duration = performance['now']() - this.frameStart
    this.frameSamples[this.currentFrameSample * 2 + 1] = duration
    this.frameSamples[this.currentFrameSample * 2 + 1 + 1] = trueSleepTime
    if (++this.currentFrameSample === this.frameSamplesCount) this.currentFrameSample = 0
    this.frameSamples[0] = this.currentFrameSample
  }
  public getFrameTimeRaw(): Readonly<Float32Array> {
    return this.frameSamples
  }
}
