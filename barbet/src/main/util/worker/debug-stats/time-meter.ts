import { createNewBuffer } from "../../shared-memory";
import { REQUESTED_MEASUREMENTS } from "./requsted-measurements";

const currentTime = () => performance['now']()

export const enum HeaderFields {
    SESSION_INDEX,
    SAMPLES_PER_SESSION,
    SIZE,
}

abstract class TimeMeterGeneric<T extends number> {
    private lastReset: number = 0
    private usingShifted: boolean = false
    private measuredSamples: number = 0

    public constructor(
        private readonly count: T,
        private readonly durationMs: number,
        protected readonly measurements: Float32Array) {

        this.measurements[HeaderFields.SAMPLES_PER_SESSION] = this.measuredSamples
        this.measurements[HeaderFields.SESSION_INDEX] = this.usingShifted ? 0 : 1
    }

    public submitTime(step: T, value: number): void {
        this.handleSubmitTime(value, step + (this.usingShifted ? this.count : 0) + HeaderFields.SIZE)
    }

    protected abstract handleSubmitTime(value: number, index: number): void

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

class TimeMeterSum<T extends number> extends TimeMeterGeneric<T> {
    protected handleSubmitTime(value: number, index: number): void {
        this.measurements[index] += value
    }
}

class TimeMeterMax<T extends number> extends TimeMeterGeneric<T> {
    protected handleSubmitTime(value: number, index: number): void {
        if (this.measurements[index]! < value)
            this.measurements[index] = value
    }
}

export default class TimeMeter<T extends number> {
    private readonly rawBuffer: SharedArrayBuffer
    private readonly measurements: TimeMeterGeneric<T>[] = []

    private enabled: boolean = false
    private currentStep: T = 0 as T
    private currentStepStart: number = 0

    public constructor(private readonly count: T) {
        const measurementsCount = REQUESTED_MEASUREMENTS['length']

        const buffer = createNewBuffer(Float32Array.BYTES_PER_ELEMENT * (count * 2 + HeaderFields.SIZE) * measurementsCount)

        const bytesOffset = (this.count * 2 + HeaderFields.SIZE) * Float32Array.BYTES_PER_ELEMENT
        this.rawBuffer = buffer

        this.measurements = REQUESTED_MEASUREMENTS['map']((m, i) => new (m.isSum ? TimeMeterSum : TimeMeterMax)<T>(this.count, m.intervalMilliseconds,
            new Float32Array(buffer, bytesOffset * i, this.count * 2 + HeaderFields.SIZE)))
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled
    }

    public beginSession(firstStep: T): void {
        this.currentStep = firstStep
        this.currentStepStart = currentTime()
    }

    public nowStart(nextStep: T): void {
        if (!this.enabled) return
        const now = currentTime();
        const duration = now - this.currentStepStart
        const currentStep = this.currentStep;

        for (const m of this.measurements)
            m.submitTime(currentStep, duration)

        this.currentStep = nextStep
        this.currentStepStart = now
    }

    public endSessionAndGetRawResults(): Readonly<ArrayBuffer> {
        if (this.enabled) {
            this.nowStart(0 as T)
            const now = currentTime();
            for (const m of this.measurements)
                m.endSession(now)
        }

        return this.rawBuffer
    }

    public getRawBuffer(): SharedArrayBuffer {
        return this.rawBuffer
    }
}