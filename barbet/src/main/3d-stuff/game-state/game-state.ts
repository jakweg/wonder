import { ActivityId, requireActivity } from '../renderable/unit/activity'
import { World } from '../world/world'
import { GroundItemsIndex } from './ground-items-index'
import { PathFinder } from './path-finder'
import { DataOffsetWithActivity, UnitTraits } from './units/traits'
import UnitsContainer from './units/units-container'


export const ACTIVITY_MEMORY_SIZE = 20

export class GameState {
	private isRunningLogic: boolean = false

	private constructor(public readonly world: World,
	                    public readonly groundItems: GroundItemsIndex,
	                    public readonly units: UnitsContainer,
	                    public readonly pathFinder: PathFinder) {
	}

	private _currentTick: number = 0

	public get currentTick(): number {
		return this._currentTick | 0
	}

	public static createNew(
		world: World,
		groundItems: GroundItemsIndex,
		units: UnitsContainer,
		pathFinder: PathFinder): GameState {
		return new GameState(world, groundItems, units, pathFinder)
	}

	public advanceActivities() {
		if (this.isRunningLogic) throw new Error()
		this.isRunningLogic = true
		this._currentTick++

		this.pathFinder.tick(this)

		const memory = this.units.withActivities.rawData
		for (const entity of this.units.iterate(UnitTraits.WithActivity)) {
			const currentActivity = memory[entity.withActivity + DataOffsetWithActivity.CurrentId]! as ActivityId

			requireActivity(currentActivity).perform(this, entity)
		}

		this.isRunningLogic = false
	}
}
