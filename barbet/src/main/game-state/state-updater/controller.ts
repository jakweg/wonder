import { BufferField, Status } from './'

export interface StateUpdater {
	start(ticksPerSecond: number): void

	changeTickRate(ticksPerSecond: number): void

	getTickRate(): number

	getExecutedTicksCount(): number

	getCurrentStatus(): Status

	estimateCurrentGameTickTime(workerStartDelay: number): number

	stop(): void
}

export const createStateUpdaterControllerFromReceived = (data: any): StateUpdater => {
	const memory = new Int32Array(data.buffer)

	return {
		start(ticksPerSecond: number) {
			Atomics.store(memory, BufferField.ExpectedTicksPerSecond, ticksPerSecond)
			Atomics.compareExchange(memory, BufferField.Status, Status.Stopped, Status.RequestedStart)
		},
		changeTickRate(ticksPerSecond: number) {
			Atomics.store(memory, BufferField.ExpectedTicksPerSecond, ticksPerSecond)
		},
		getTickRate(): number {
			return Atomics.load(memory, BufferField.TicksPerSecond)
		},
		getExecutedTicksCount(): number {
			return Atomics.load(memory, BufferField.ExecutedTicksCounter)
		},
		getCurrentStatus(): Status {
			return Atomics.load(memory, BufferField.Status) as Status
		},
		estimateCurrentGameTickTime(workerStartDelay: number): number {
			const executedTicks = Atomics.load(memory, BufferField.ExecutedTicksCounter)
			if (Atomics.load(memory, BufferField.Status) !== Status.Running)
				return executedTicks

			const now = performance.now()
			const lastTickFinishTime = Atomics.load(memory, BufferField.LastTickFinishTime) / 100
			const tps = Atomics.load(memory, BufferField.TicksPerSecond)
			const millisPerTick = 1000 / tps

			return executedTicks + (now - lastTickFinishTime - workerStartDelay) / millisPerTick
		},
		stop() {
			if (Status.RequestedStart === Atomics.compareExchange(memory, BufferField.Status, Status.RequestedStart, Status.Stopped))
				return // prevented starting

			if (Status.Running === Atomics.compareExchange(memory, BufferField.Status, Status.Running, Status.RequestedStop))
				return // requested stop from running

			return // not done anything, already requested stop, stopped or terminated
		},
	}
}
