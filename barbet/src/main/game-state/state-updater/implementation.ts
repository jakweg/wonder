import TickQueue from '../../network/tick-queue'
import { TickQueueActionType, UpdaterAction } from '../../network/tick-queue-action'
import { isInWorker, waitAsyncCompat } from '../../util/game-mutex'

import { createNewBuffer } from '../../util/shared-memory'
import { ScheduledAction } from '../scheduled-actions'
import { BufferField, Status } from './'

export interface StateUpdaterImplementation {
	pass(): unknown

	terminate(): void
}


const waitForStatusNotStopped = async (memory: Int32Array): Promise<Status> => {
	while (true) {
		const status = Atomics.load(memory, BufferField.Status) as Status
		if (status !== Status.Stopped)
			return status

		await new Promise(resolve => setTimeout(resolve, 0))
		await ((isInWorker ? Atomics.wait : waitAsyncCompat)(memory, BufferField.Status, status, 50) as unknown as any)['value']
	}
}

const performLogicUpdates = async (memory: Int32Array,
	func: (tick: number) => Promise<boolean>): Promise<boolean> => {
	const now = performance.now()
	const firstExecutedAt = Atomics.load(memory, BufferField.FirstTickExecutedAt)
	const tps = Atomics.load(memory, BufferField.TicksPerSecond)
	const currentTick = Atomics.load(memory, BufferField.ExecutedTicksCounter)
	const millisPerTick = 1000 / tps
	const shouldBeNowAtTick = ((now - firstExecutedAt) / millisPerTick) | 0

	const ticksToExecute = shouldBeNowAtTick - currentTick

	if (ticksToExecute > 100 || ticksToExecute < 0) {
		// might have been a lag, return false to reset counter
		return false
	}

	if (ticksToExecute > 0) {
		for (let i = 0; i < ticksToExecute; i++) {
			try {
				if (Atomics.load(memory, BufferField.Status) !== Status.Running)
					break

				const nowWas = performance.now() * 100
				const tickNumberToExecute = currentTick + i + 1
				const executedTick = await func(tickNumberToExecute)
				if (executedTick) {
					Atomics.store(memory, BufferField.LastTickFinishTime, nowWas)
					Atomics.store(memory, BufferField.ExecutedTicksCounter, tickNumberToExecute)
				} else {
					// console.warn('Skipped tick execution', tickNumberToExecute)
					return false
				}
			} catch (e) {
				console.error(e)
				console.error('Terminating state updater')
				Atomics.store(memory, BufferField.Status, Status.Terminated)
				throw new Error(e)
			}
		}
	}
	return true
}

const runNow = async (memory: Int32Array, func: (tick: number) => Promise<boolean>) => {
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

			const everythingOk = await performLogicUpdates(memory, func)
			if (!everythingOk) {
				// probably lacking network data, wait some time and then try again
				clearInterval(intervalId)
				new Promise(resolve => setTimeout(resolve, 50))
					.then(() => runNow(memory, func))
					.then(resolve)
				return
			}
			executing = false
		}
		intervalId = setInterval(executeLogic, millisPerTick)
		executeLogic()
	})

}

const loop = async (memory: Int32Array, func: (tick: number) => Promise<boolean>) => {
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

export const createNewStateUpdater = (updatable: (gameActions: ScheduledAction[], updaterActions: UpdaterAction[]) => Promise<void>,
	startFromTick: number,
	tickQueue: TickQueue)
	: StateUpdaterImplementation => {

	const memory = new Int32Array(createNewBuffer(BufferField.SIZE * Int32Array.BYTES_PER_ELEMENT))
	memory.fill(0)
	memory[BufferField.Status] = Status.Stopped
	memory[BufferField.ExecutedTicksCounter] = startFromTick
	// memory[BufferField.ExpectedTicksPerSecond] = memory[BufferField.TicksPerSecond] = 1

	const tryRun = async (tick: number): Promise<boolean> => {
		const actions = tickQueue.popActionsForTick(tick)
		if (actions !== undefined) {

			const updaterActions = actions.filter(e => e.type === TickQueueActionType.UpdaterAction).map(e => e.action) as UpdaterAction[]
			const gameActions = actions.filter(e => e.type === TickQueueActionType.GameAction).map(e => e.action) as ScheduledAction[]

			await updatable(gameActions, updaterActions)
			if (updaterActions.length > 0) {
				for (const action of updaterActions) {
					switch (action.type) {
						case 'pause':
							Atomics.compareExchange(memory, BufferField.Status, Status.Running, Status.RequestedStop)
							break
					}
				}
			}
			return true
		}
		return false
	}

	// noinspection JSIgnoredPromiseFromCall
	loop(memory, tryRun)

	return {
		pass(): unknown {
			return { buffer: memory['buffer'] }
		},
		terminate(): void {
			Atomics.store(memory, BufferField.Status, Status.Terminated)
		},
	}
}
