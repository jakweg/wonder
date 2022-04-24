import { isInWorker, waitAsyncCompat } from '../../util/mutex'
import { createNewBuffer } from '../../util/shared-memory'
import { BufferField, Status } from './'

type Updatable = () => Promise<void>

export interface StateUpdaterImplementation {
	pass(): unknown

	terminate(): void
}


const waitForStatusNotStopped = async (memory: Int32Array): Promise<Status> => {
	while (true) {
		const status = Atomics.load(memory, BufferField.Status) as Status
		if (status !== Status.Stopped)
			return status

		await ((isInWorker ? Atomics.wait : waitAsyncCompat)(memory, BufferField.Status, status, 1000) as unknown as any)['value']
	}
}

const performLogicUpdates = async (memory: Int32Array,
                                   func: Updatable): Promise<void> => {
	const now = performance.now()
	const firstExecutedAt = Atomics.load(memory, BufferField.FirstTickExecutedAt)
	const tps = Atomics.load(memory, BufferField.TicksPerSecond)
	const currentTick = Atomics.load(memory, BufferField.ExecutedTicksCounter)
	const millisPerTick = 1000 / tps
	const shouldBeNowAtTick = ((now - firstExecutedAt) / millisPerTick) | 0

	const ticksToExecute = shouldBeNowAtTick - currentTick

	if (ticksToExecute > 100 || ticksToExecute < 0) {
		console.error(`Lag? expected ${ticksToExecute} ticks to execute at once`)
		Atomics.store(memory, BufferField.Status, Status.Terminated)
		return
	}

	if (ticksToExecute > 0) {
		Atomics.store(memory, BufferField.LastTickFinishTime, performance.now() * 100)
		Atomics.store(memory, BufferField.ExecutedTicksCounter, currentTick + ticksToExecute)
		for (let i = 0; i < ticksToExecute; i++) {
			try {
				await func()
			} catch (e) {
				console.error(e)
				console.error('Terminating state updater')
				Atomics.store(memory, BufferField.Status, Status.Terminated)
				return
			}
		}
	}
}

const runNow = async (memory: Int32Array, func: Updatable) => {
	const previousValue = Atomics.compareExchange(memory, BufferField.Status, Status.RequestedStart, Status.Running)
	if (Status.RequestedStart !== previousValue && Status.Running !== previousValue)
		return

	const expectedTps = Atomics.load(memory, BufferField.ExpectedTicksPerSecond)
	if (expectedTps <= 0)
		throw new Error(`Invalid tps ${expectedTps}`)

	const millisPerTick = 1000 / expectedTps

	const now = performance.now()
	Atomics.store(memory, BufferField.TicksPerSecond, expectedTps)
	const alreadyExecutedTicks = Atomics.load(memory, BufferField.ExecutedTicksCounter)
	Atomics.store(memory, BufferField.FirstTickExecutedAt, now - millisPerTick * (alreadyExecutedTicks + 1))
	Atomics.store(memory, BufferField.LastTickFinishTime, (now - millisPerTick) * 100)

	return new Promise<void>(resolve => {
		let intervalId: number = 0
		let executing: boolean = false
		const executeLogic = async () => {
			if (executing) return
			executing = true
			const currentStatus = Atomics.load(memory, BufferField.Status) as Status
			if (currentStatus !== Status.Running) {
				clearInterval(intervalId)
				resolve()
				return
			}

			const newTps = Atomics.load(memory, BufferField.ExpectedTicksPerSecond)
			if (newTps !== expectedTps) {
				// tps change occurred, start now again
				clearInterval(intervalId)
				runNow(memory, func).then(resolve)
				return
			}

			await performLogicUpdates(memory, func)
			executing = false
		}
		intervalId = setInterval(executeLogic, millisPerTick)
		executeLogic()
	})

}

const loop = async (memory: Int32Array, func: Updatable) => {
	while (true) {
		const status = await waitForStatusNotStopped(memory)
		if (status === Status.Terminated)
			return

		switch (status) {
			case Status.RequestedStop:
				Atomics.compareExchange(memory, BufferField.Status, status, Status.Stopped)
				break

			case Status.Running:
			case Status.RequestedStart:
				await runNow(memory, func)
				break

			default:
				throw new Error()
		}
	}
}

export const createNewStateUpdater = (updatable: Updatable,
                                      startFromTick: number)
	: StateUpdaterImplementation => {

	const memory = new Int32Array(createNewBuffer(BufferField.SIZE * Int32Array.BYTES_PER_ELEMENT))
	memory.fill(0)
	memory[BufferField.Status] = Status.Stopped
	memory[BufferField.ExecutedTicksCounter] = startFromTick
	// memory[BufferField.ExpectedTicksPerSecond] = memory[BufferField.TicksPerSecond] = 1

	// noinspection JSIgnoredPromiseFromCall
	loop(memory, updatable)

	return {
		pass(): unknown {
			return {buffer: memory['buffer']}
		},
		terminate(): void {
			Atomics.store(memory, BufferField.Status, Status.Terminated)
		},
	}
}
