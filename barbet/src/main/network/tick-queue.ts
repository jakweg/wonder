import { TickQueueAction } from './tick-queue-action'

export default class TickQueue {
	private constructor(
		private readonly ticksMap: Map<number, Map<number, TickQueueAction[]>>,
		private readonly requiredPlayerIds: Set<number>,
	) {
	}

	public static createEmpty(): TickQueue {
		return new TickQueue(new Map(), new Set<number>())
	}

	public addRequiredPlayer(playerId: number): void {
		this.requiredPlayerIds.add(playerId)
	}

	public getActorIds(): number[] {
		return [...this.requiredPlayerIds.keys()]
	}

	public setForTick(tick: number, playerId: number, actions: TickQueueAction[]): void {
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

		if (value['size'] !== this.requiredPlayerIds['size'])
			return

		const actions = [...value.values()].flatMap(e => e)
		actions['sort']((a, b) => a.initiatorId - b.initiatorId)
		return actions
	}
}
