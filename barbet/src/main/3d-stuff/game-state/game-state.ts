import { ActivityId, requireActivity } from '../renderable/unit/activity'
import { World } from '../world/world'
import EntityContainer from './entities/entity-container'
import { DataOffsetWithActivity, EntityTrait } from './entities/traits'
import { GroundItemsIndex } from './ground-items-index'
import { PathFinder } from './path-finder'


export class GameState {
	private isRunningLogic: boolean = false

	private constructor(public readonly world: World,
	                    public readonly groundItems: GroundItemsIndex,
	                    public readonly entities: EntityContainer,
	                    public readonly pathFinder: PathFinder) {
	}

	private _currentTick: number = 0

	public get currentTick(): number {
		return this._currentTick | 0
	}

	public static createNew(
		world: World,
		groundItems: GroundItemsIndex,
		entities: EntityContainer,
		pathFinder: PathFinder): GameState {
		return new GameState(world, groundItems, entities, pathFinder)
	}

	public advanceActivities() {
		if (this.isRunningLogic) throw new Error()
		this.isRunningLogic = true
		this._currentTick++

		this.pathFinder.tick(this)

		const memory = this.entities.withActivities.rawData
		for (const entity of this.entities.iterate(EntityTrait.WithActivity)) {
			const currentActivity = memory[entity.withActivity + DataOffsetWithActivity.CurrentId]! as ActivityId

			requireActivity(currentActivity).perform(this, entity)
		}

		this.isRunningLogic = false
	}
}
