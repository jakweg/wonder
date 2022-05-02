import { TickQueueAction } from './tick-queue-action'

export default class TickQueue {
	private constructor(
		private readonly ticksMap: Map<number, Map<number, TickQueueAction[]>>,
		private readonly requiredPlayerIds: Map<number, number>,
	) {
	}

	public static createEmpty(): TickQueue {
		return new TickQueue(new Map(), new Map())
	}

	public addRequiredPlayer(playerId: number, sinceTick: number): void {
		this.requiredPlayerIds.set(playerId, sinceTick)
	}

	public setForTick(tick: number, playerId: number, actions: TickQueueAction[]): void {
		if (!this.requiredPlayerIds.has(playerId))
			throw new Error(`Unexpected player id ${playerId}`)

		let actionsToDoAtThisTick = this.ticksMap.get(tick)
		if (actionsToDoAtThisTick === undefined) {
			actionsToDoAtThisTick = new Map<number, TickQueueAction[]>()
			this.ticksMap.set(tick, actionsToDoAtThisTick)
		}

		const actionsToDoByThisPlayer = actionsToDoAtThisTick.get(playerId)
		if (actionsToDoByThisPlayer !== undefined)
			throw new Error(`Actions for tick ${tick} by player ${playerId} already set`)

		actionsToDoAtThisTick.set(playerId, [...actions])
	}

	public popActionsForTick(tick: number): TickQueueAction[] | undefined {
		const value = this.ticksMap.get(tick)
		if (value === undefined)
			return

		if (value.size !== this.requiredPlayerIds.size) {
			// investigate more
			if ([...this.requiredPlayerIds.values()].filter(since => since <= tick).length !== value.size)
				return
		}

		const actions = [...value.values()].flatMap(e => e)
		actions.sort((a, b) => a.initiatorId - b.initiatorId)
		return actions
	}
}
