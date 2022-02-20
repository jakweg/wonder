import { GameState } from './game-state'

type StopResult = 'stopped' | 'already-stopped'

export class StateUpdater {
	private _intervalId: number = 0
	private _requestStartTime: number = 0
	private _executedTicksCounter: number = 0
	private _maxTicksToPerformAtOnce: number = 20
	private _stopPromise: Promise<StopResult> | null = null
	private _stopPromiseResolve: ((value: StopResult) => void) | null = null
	private _lastTickFinishTime: number = 0

	private constructor(private readonly _state: GameState,
	                    private _expectedDelayBetweenTicks: number) {
		this._executedTicksCounter = _state.currentTick
	}

	public static createNew(state: GameState,
	                        ticksPerSecond: number): StateUpdater {
		return new StateUpdater(state, 1000 / ticksPerSecond)
	}

	public start(ticksPerSecond: number | undefined = undefined): void {
		if (this._intervalId !== 0)
			return

		clearInterval(this._intervalId)

		if (ticksPerSecond !== undefined) {
			this._expectedDelayBetweenTicks = (1000 / ticksPerSecond)
		}

		this._lastTickFinishTime = this._requestStartTime = performance.now() - this._executedTicksCounter * this._expectedDelayBetweenTicks
		this._intervalId = setInterval(() => this.handleTimer(), this._expectedDelayBetweenTicks)
	}

	public stop(): Promise<StopResult> {
		if (this._intervalId === 0)
			return Promise.resolve('already-stopped')

		if (this._stopPromise == null)
			this._stopPromise = new Promise(resolve => this._stopPromiseResolve = resolve)

		return this._stopPromise
	}

	public estimateCurrentGameTickTime(): number {
		if (this._intervalId === 0) {
			// game is stopped
			return this._executedTicksCounter
		}
		const now = performance.now()
		const sinceLastTick = (now - this._lastTickFinishTime) / this._expectedDelayBetweenTicks
		const allTicksTime = this._executedTicksCounter

		return allTicksTime + sinceLastTick
	}

	private stopInstantly() {
		clearInterval(this._intervalId)
		this._intervalId = 0
	}

	private handleTimer(): void {
		const now = performance.now()
		const timeSinceStart = now - this._requestStartTime
		const expectedExecutedTicks = (timeSinceStart / this._expectedDelayBetweenTicks) | 0
		const ticksToExecute = expectedExecutedTicks - this._executedTicksCounter

		if (ticksToExecute > this._maxTicksToPerformAtOnce) {
			this.stopInstantly()
			throw new Error(`State updater stopped due to lag: missed ${ticksToExecute} ticks`)
		}

		for (let i = 0; i < ticksToExecute; i++) {
			try {
				this._state.advanceActivities()
				this._executedTicksCounter++
			} catch (e) {
				this.stopInstantly()
				throw e
			}
		}
		this._lastTickFinishTime = performance.now()

		const resolve = this._stopPromiseResolve
		if (resolve != null) {
			this._stopPromiseResolve = this._stopPromise = null
			this.stopInstantly()
			resolve('stopped')
		}
	}
}
