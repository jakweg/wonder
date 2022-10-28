const currentTime = () => performance['now']()

export default class TimeMeter<T extends number> {
    private measurements: Float32Array
    private currentStep: T = 0 as T
    private currentStepStart: number = 0

    public constructor(count: T) {
        this.measurements = new Float32Array(count)
    }

    public beginSession(firstStep: T): void {
        this.measurements['fill'](0)
        this.currentStep = firstStep
        this.currentStepStart = currentTime()
    }

    public nowStart(nextStep: T): void {
        const now = currentTime();
        const duration = now - this.currentStepStart
        this.measurements[this.currentStep] = duration
        this.currentStep = nextStep
        this.currentStepStart = now
    }

    public endSessionAndGetRawResults(): Readonly<Float32Array> {
        return this.measurements
    }
}