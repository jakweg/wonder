import { createNewBuffer } from "../../util/shared-memory";
import { REQUESTED_MEASUREMENTS } from "./draw-phase";

const currentTime = () => performance['now']()

export const enum HeaderFields {
    SESSION_INDEX,
    SAMPLES_PER_SESSION,
    SIZE,
}

class TimeMeterSum<T extends number> {
    private lastReset: number = 0
    private usingShifted: boolean = false
    private measuredSamples: number = 0

    public constructor(
        private readonly count: T,
        private readonly durationMs: number,
        private readonly measurements: Float32Array) {

        this.measurements[HeaderFields.SAMPLES_PER_SESSION] = this.measuredSamples
        this.measurements[HeaderFields.SESSION_INDEX] = this.usingShifted ? 0 : 1
    }

    public submitTime(step: T, value: number): void {
        this.measurements[step + (this.usingShifted ? this.count : 0) + HeaderFields.SIZE] += value
    }

    public endSession(now: number) {
        this.measuredSamples++
        if (now - this.lastReset > this.durationMs) {
            this.lastReset = now
            this.usingShifted = !this.usingShifted
            this.measurements.fill(0,
                HeaderFields.SIZE + (this.usingShifted ? this.count : 0),
                HeaderFields.SIZE + this.count + (this.usingShifted ? this.count : 0))
            this.measurements[HeaderFields.SESSION_INDEX] = (this.measurements[HeaderFields.SESSION_INDEX]! + 1) & 0xFFFF
            this.measurements[HeaderFields.SAMPLES_PER_SESSION] = this.measuredSamples
            this.measuredSamples = 0
        }
    }
}

export default class TimeMeter<T extends number> {
    private readonly rawBuffer: SharedArrayBuffer
    private readonly measurements: TimeMeterSum<T>[] = []

    private currentStep: T = 0 as T
    private currentStepStart: number = 0

    public constructor(private readonly count: T) {
        const measurementsCount = REQUESTED_MEASUREMENTS['length']

        const buffer = createNewBuffer(Float32Array.BYTES_PER_ELEMENT * (count * 2 + HeaderFields.SIZE) * measurementsCount)

        const bytesOffset = (this.count * 2 + HeaderFields.SIZE) * Float32Array.BYTES_PER_ELEMENT
        this.rawBuffer = buffer

        this.measurements = REQUESTED_MEASUREMENTS['map']((m, i) => new TimeMeterSum<T>(this.count, m.intervalMilliseconds,
            new Float32Array(buffer, bytesOffset * i, this.count * 2 + HeaderFields.SIZE)))
    }

    public beginSession(firstStep: T): void {
        this.currentStep = firstStep
        this.currentStepStart = currentTime()
    }

    public nowStart(nextStep: T): void {
        const now = currentTime();
        const duration = now - this.currentStepStart
        const currentStep = this.currentStep;

        for (const m of this.measurements)
            m.submitTime(currentStep, duration)

        this.currentStep = nextStep
        this.currentStepStart = now
    }

    public endSessionAndGetRawResults(): Readonly<ArrayBuffer> {
        this.nowStart(0 as T)
        const now = currentTime();
        for (const m of this.measurements)
            m.endSession(now)

        return this.rawBuffer
    }
}