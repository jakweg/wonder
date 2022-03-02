import { requireActivity } from '../renderable/unit/activity'
import { World } from '../world/world'
import { GroundItemsIndex } from './ground-items-index'
import { PathFinder } from './path-finder'
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

		for (const unit of [...this._units]) {
			const activity = requireActivity(unit.activityId)

			// activity.perform(this, unit)
		}
		this.isRunningLogic = false
	}
}
