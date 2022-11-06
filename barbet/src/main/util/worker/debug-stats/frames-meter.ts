import { createNewBuffer } from '../../shared-memory'

export class FramesMeter {
  private frameSamples: Float32Array
  private currentFrameSample: number = 0
  private frameStart: number = 0

  public constructor(private readonly frameSamplesCount: number) {
    this.frameSamples = new Float32Array(createNewBuffer((frameSamplesCount + 1) * Float32Array.BYTES_PER_ELEMENT))
  }

  public frameStarted(): void {
    this.frameStart = performance['now']()
  }
  public frameEnded(trueTime?: number): void {
    const duration = trueTime ?? performance['now']() - this.frameStart
    this.frameSamples[this.currentFrameSample + 1] = duration
    this.frameSamples[0] = this.currentFrameSample + 1
    if (++this.currentFrameSample === this.frameSamplesCount) this.currentFrameSample = 0
  }
  public getFrameTimeRaw(): Readonly<Float32Array> {
    return this.frameSamples
  }
}
