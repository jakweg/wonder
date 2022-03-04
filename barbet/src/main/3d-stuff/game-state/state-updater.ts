import Mutex, { Lock, waitAsyncCompat } from '../../util/mutex'
import { globalMutex } from '../../worker/worker-global-state'
import { GameState } from './game-state'

export const STANDARD_GAME_TICK_RATE = 20

type StopResult = 'stopped' | 'already-stopped'

export const enum Status {
	Stopped,
	RequestedStart,
	RequestedStop,
	RequestedTickRateChange,
	Running,
}

export const enum MemoryField {
	Status,
	LastTickFinishTime,
	TicksPerSecond,
	ExecutedTicksCounter,
	ExpectedDelayBetweenTicks,
	SIZE,
}

export type StateUpdater = ReturnType<typeof stateUpdaterFromReceived>
export const stateUpdaterFromReceived = (mutex: Mutex,
                                         data: any) => {
	if (data?.type !== 'state-updater')
		throw new Error('Invalid state updater')

	const memory = new Int32Array(data.buffer)

	return {
		async start(ticksPerSecond?: number): Promise<void> {
			await mutex.executeWithAcquiredAsync(Lock.StateUpdaterStatus, () => {
				if (Atomics.load(memory, MemoryField.Status) === Status.Stopped) {
					if (ticksPerSecond !== undefined)
						Atomics.store(memory, MemoryField.TicksPerSecond, ticksPerSecond)
					Atomics.store(memory, MemoryField.Status, Status.RequestedStart)
					Atomics.notify(memory, MemoryField.Status)
				}
			})
		},
		async changeTickRate(ticksPerSecond: number): Promise<void> {
			Atomics.store(memory, MemoryField.TicksPerSecond, ticksPerSecond)
			Atomics.compareExchange(memory, MemoryField.Status, Status.Running, Status.RequestedTickRateChange)
		},
		getTickRate(): number {
			return Atomics.load(memory, MemoryField.TicksPerSecond)
		},
		estimateCurrentGameTickTime(workerStartDelay: number): number {
			const executedTicks = Atomics.load(memory, MemoryField.ExecutedTicksCounter)
			if (Atomics.load(memory, MemoryField.Status) === Status.Stopped)
				return executedTicks

			const now = performance.now()
			const lastTickFinishTime = Atomics.load(memory, MemoryField.LastTickFinishTime) / 100
			const delayBetweenTicks = Atomics.load(memory, MemoryField.ExpectedDelayBetweenTicks) / 1_000_000
			const sinceLastTick = (now - workerStartDelay - lastTickFinishTime) / delayBetweenTicks

			return executedTicks + sinceLastTick
		},
		stop(): Promise<StopResult> {
			if (Atomics.load(memory, MemoryField.Status) === Status.Stopped)
				return Promise.resolve('already-stopped')

			Atomics.store(memory, MemoryField.Status, Status.RequestedStop)
			const wait = waitAsyncCompat(memory, MemoryField.Status, Status.RequestedStop)
			if (wait.async)
				return wait.value.then(() => 'stopped')
			else
				return Promise.resolve('stopped')
		},
	}
}

export const createNewStateUpdater = (mutex: Mutex,
                                      state: GameState) => {
	let intervalId = 0
	let expectedDelayBetweenTicks = 0
	let requestStartTime = 0
	let executedTicksCounter = 0
	let maxTicksToPerformAtOnce = 20
	let ticksPerSecond = 0

	const buffer = new SharedArrayBuffer(MemoryField.SIZE * Int32Array.BYTES_PER_ELEMENT)
	const memory = new Int32Array(buffer)
	memory[MemoryField.Status] = Status.Stopped

	const setupStartRequestMonitoring = async () => {
		await (waitAsyncCompat(memory, MemoryField.Status, Status.Stopped) as any)?.value
		const oldValue = Atomics.compareExchange(memory, MemoryField.Status, Status.RequestedStart, Status.Running)
		if (oldValue !== Status.RequestedStart) {
			throw new Error(`Expected requested stop value, but got ${oldValue}`)
		}
		await globalMutex.executeWithAcquiredAsync(Lock.StateUpdaterStatus, init)
		return
	}
	// noinspection JSIgnoredPromiseFromCall
	setupStartRequestMonitoring()

	const stopInstantly = () => {
		clearInterval(intervalId)
		memory[MemoryField.Status] = Status.Stopped
		intervalId = 0
		// noinspection JSIgnoredPromiseFromCall
		setupStartRequestMonitoring()
	}

	let lastTickTimeToSet = 0

	function init() {
		if (intervalId !== 0)
			return

		ticksPerSecond = memory[MemoryField.TicksPerSecond]!
		if (ticksPerSecond <= 0)
			throw new Error('Invalid tps')

		clearInterval(intervalId)


		expectedDelayBetweenTicks = 1000 / ticksPerSecond
		Atomics.store(memory, MemoryField.ExpectedDelayBetweenTicks, expectedDelayBetweenTicks * 1_000_000)

		requestStartTime = performance.now() - executedTicksCounter * expectedDelayBetweenTicks
		memory[MemoryField.LastTickFinishTime] = (requestStartTime + executedTicksCounter * expectedDelayBetweenTicks) * 10
		memory[MemoryField.Status] = Status.Running
		intervalId = setInterval(handleTimer, expectedDelayBetweenTicks)
	}

	const handleStatus = () => {
		Atomics.store(memory, MemoryField.LastTickFinishTime, lastTickTimeToSet)
		Atomics.store(memory, MemoryField.ExecutedTicksCounter, executedTicksCounter)
		const status = Atomics.load(memory, MemoryField.Status) as Status
		if (status === Status.RequestedStop) {
			Atomics.store(memory, MemoryField.Status, Status.Stopped)
			stopInstantly()
		} else if (status === Status.RequestedTickRateChange) {
			stopInstantly()
			init()
		}
	}

	const handleTimer = () => {
		const now = performance.now()
		const timeSinceStart = now - requestStartTime
		const expectedExecutedTicks = (timeSinceStart / expectedDelayBetweenTicks) | 0

		const ticksToExecute = expectedExecutedTicks - executedTicksCounter | 0
		if (ticksToExecute < 0) {
			stopInstantly()
			throw new Error(`negative ticks ${ticksToExecute}`)
		}

		if (ticksToExecute > maxTicksToPerformAtOnce) {
			stopInstantly()
			throw new Error(`State updater stopped due to lag: missed ${ticksToExecute} ticks`)
		}

		for (let i = 0; i < ticksToExecute; i++) {
			try {
				state.advanceActivities()
				executedTicksCounter++
			} catch (e) {
				stopInstantly()
				throw e
			}

		}

		lastTickTimeToSet = performance.now() * 100 | 0
		mutex.executeWithAcquired(Lock.StateUpdaterStatus, handleStatus)
	}

	return {
		pass(): unknown {
			return {
				type: 'state-updater',
				buffer,
			}
		},
	}
}
