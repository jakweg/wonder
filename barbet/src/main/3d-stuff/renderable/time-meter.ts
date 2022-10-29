import { createNewBuffer } from "../../util/shared-memory";

const currentTime = () => performance['now']()

export const enum HeaderFields {
    USING_SHIFTED,
    SIZE,
}

class TimeMeterSum<T extends number> {
    private lastReset: number = 0
    private usingShifted: boolean = false

    public constructor(
        private readonly count: T,
        private readonly durationMs: number,
        private readonly measurements: Float32Array) {

        this.measurements[HeaderFields.USING_SHIFTED] = this.usingShifted ? 0 : 1
    }

    public submitTime(step: T, value: number): void {
        this.measurements[step + (this.usingShifted ? this.count : 0) + HeaderFields.SIZE] += value
    }

    public endSession(now: number) {
        if (now - this.lastReset > this.durationMs) {
            this.lastReset = now
            this.usingShifted = !this.usingShifted
            this.measurements.fill(0,
                HeaderFields.SIZE + (this.usingShifted ? this.count : 0),
                HeaderFields.SIZE + this.count + (this.usingShifted ? this.count : 0))
            this.measurements[HeaderFields.USING_SHIFTED] = this.usingShifted ? 0 : 1
        }
    }
}

export default class TimeMeter<T extends number> {
    private readonly rawBuffer: SharedArrayBuffer
    // private readonly measurements: Float32Array

    private currentStep: T = 0 as T
    private currentStepStart: number = 0

    public constructor(private readonly count: T) {
        const measurementsCount = 1
        const buffer = createNewBuffer(Float32Array.BYTES_PER_ELEMENT * (count * 2 + HeaderFields.SIZE) * measurementsCount)
        const bytesOffset = (this.count * 2 + HeaderFields.SIZE) * Float32Array.BYTES_PER_ELEMENT
        this.rawBuffer = buffer
        this.sum5s = new TimeMeterSum<T>(this.count, 1_000, new Float32Array(buffer, bytesOffset * 0, this.count * 2 + HeaderFields.SIZE))
    }

    private readonly sum5s

    public beginSession(firstStep: T): void {
        this.currentStep = firstStep
        this.currentStepStart = currentTime()
    }

    public nowStart(nextStep: T): void {
        const now = currentTime();
        const duration = now - this.currentStepStart
        const currentStep = this.currentStep;

        this.sum5s.submitTime(currentStep, duration)

        this.currentStep = nextStep
        this.currentStepStart = now
    }

    public endSessionAndGetRawResults(): Readonly<ArrayBuffer> {
        this.nowStart(0 as T)
        const now = currentTime();
        this.sum5s.endSession(now)

        return this.rawBuffer
    }
}