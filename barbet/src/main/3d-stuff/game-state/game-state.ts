import Mutex, { Lock } from '../../util/mutex'
import { ActivityId, requireActivity } from '../renderable/unit/activity'
import { World } from '../world/world'
import EntityContainer from './entities/entity-container'
import { iterateOverEntitiesWithActivity } from './entities/queries'
import { DataOffsetWithActivity } from './entities/traits'
import { GroundItemsIndex } from './ground-items-index'
import { PathFinder } from './path-finder'


export class GameState {
	private isRunningLogic: boolean = false

	private constructor(public readonly world: World,
	                    public readonly groundItems: GroundItemsIndex,
	                    public readonly entities: EntityContainer,
	                    public readonly pathFinder: PathFinder,
	                    private readonly mutex: Mutex) {
	}

	private _currentTick: number = 0

	public get currentTick(): number {
		return this._currentTick | 0
	}

	public static createNew(
		world: World,
		groundItems: GroundItemsIndex,
		entities: EntityContainer,
		pathFinder: PathFinder,
		mutex: Mutex): GameState {
		return new GameState(world, groundItems, entities, pathFinder, mutex)
	}

	public static forRenderer(object: any): GameState {
		if (object['type'] !== 'game-state') throw new Error('Invalid object')

		return new GameState(
			World.fromReceived(object['world']),
			GroundItemsIndex.fromReceived(object['groundItems']),
			EntityContainer.fromReceived(object['entities']),
			null as unknown as PathFinder,
			Mutex.fromReceived(object['mutex']))
	}

	public passForRenderer(): unknown {
		return {
			type: 'game-state',
			mutex: this.mutex.pass(),
			world: this.world.pass(),
			groundItems: this.groundItems.pass(),
			entities: this.entities.pass(),
		}
	}

	public advanceActivities() {
		if (this.isRunningLogic) throw new Error()
		this.isRunningLogic = true
		this._currentTick++

		this.pathFinder.tick(this)

		const container = this.entities
		this.mutex.executeWithAcquired(Lock.Update, () => {
			for (const entity of iterateOverEntitiesWithActivity(container)) {
				const currentActivity = (container.withActivities.rawData)[entity.withActivity + DataOffsetWithActivity.CurrentId]! as ActivityId

				requireActivity(currentActivity).perform(this, entity)
			}
		})

		this.isRunningLogic = false
	}
}
