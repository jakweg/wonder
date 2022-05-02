import { TickQueueAction } from './tick-queue-action'

export default class TickQueue {
	private constructor(
		private readonly ticksMap: Map<number, TickQueueAction[]>,
	) {
	}

	public static createEmpty(): TickQueue {
		return new TickQueue(new Map())
	}

	public setForTick(tick: number, actions: TickQueueAction[]): void {
		const existing = this.ticksMap.get(tick)
		if (existing !== undefined)
			throw new Error(`Actions for tick ${tick} already set`)
		this.ticksMap.set(tick, [...actions])
	}

	public popActionsForTick(tick: number): TickQueueAction[] | undefined {
		const value = this.ticksMap.get(tick)
		if (value !== undefined)
			this.ticksMap.delete(tick)
		return value
	}
}
