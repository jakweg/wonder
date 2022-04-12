import Mutex, { createMutexFromReceived, isInWorker, Lock } from '../../util/mutex'
import { decodeArray, encodeArray } from '../../util/persistance/serializers'
import { createNewBuffer } from '../../util/shared-memory'
import { ActivityId, requireActivity } from '../renderable/unit/activity'
import { World } from '../world/world'
import EntityContainer from './entities/entity-container'
import { iterateOverEntitiesWithActivity } from './entities/queries'
import { DataOffsetWithActivity } from './entities/traits'
import { GroundItemsIndex } from './ground-items-index'
import { PathFinder } from './path-finder'
import { SurfaceResourcesIndex } from './surface-resources-index'

export const enum MetadataField {
	CurrentTick,
	LastBuildingsChange,
	SIZE
}

export class GameState {
	private isRunningLogic: boolean = false

	private constructor(
		public readonly metaData: Int32Array,
		public readonly world: World,
		public readonly groundItems: GroundItemsIndex,
		public readonly entities: EntityContainer,
		public readonly pathFinder: PathFinder,
		public readonly surfaceResources: SurfaceResourcesIndex,
		private readonly mutex: Mutex,
		private readonly stateBroadcastCallback: () => void) {
	}

	public get currentTick(): number {
		return this.metaData[MetadataField.CurrentTick]!
	}

	public static createNew(
		world: World,
		groundItems: GroundItemsIndex,
		entities: EntityContainer,
		pathFinder: PathFinder,
		surfaceResources: SurfaceResourcesIndex,
		mutex: Mutex,
		stateBroadcastCallback: () => void): GameState {
		return new GameState(
			new Int32Array(createNewBuffer(MetadataField.SIZE * Int32Array.BYTES_PER_ELEMENT)),
			world, groundItems, entities,
			pathFinder, surfaceResources,
			mutex, stateBroadcastCallback)
	}

	public static deserialize(object: any, mutex: Mutex, stateBroadcastCallback: () => void): GameState {
		const world = World.deserialize(object['world'])
		return new GameState(
			decodeArray(object['metadata'], true, Int32Array),
			world,
			GroundItemsIndex.deserialize(object['groundItems']),
			EntityContainer.deserialize(object['entities']),
			PathFinder.deserialize(world, object['pathFinder']),
			SurfaceResourcesIndex.deserialize(object['surfaceResources']),
			mutex, stateBroadcastCallback)
	}

	public static forRenderer(object: any): GameState {
		return new GameState(
			new Int32Array(object['metadata']),
			World.fromReceived(object['world']),
			GroundItemsIndex.fromReceived(object['groundItems']),
			EntityContainer.fromReceived(object['entities']),
			null as unknown as PathFinder,
			SurfaceResourcesIndex.fromReceived(object['surfaceResources']),
			createMutexFromReceived(object['mutex']),
			() => void 0)
	}

	public passForRenderer(): unknown {
		return {
			'metadata': this.metaData.buffer,
			'mutex': this.mutex.pass(),
			'world': this.world.pass(),
			'groundItems': this.groundItems.pass(),
			'entities': this.entities.pass(),
			'surfaceResources': this.surfaceResources.pass(),
		}
	}

	public serialize(): any {
		if (this.pathFinder == null)
			throw new Error('Missing pathfinder')
		return {
			'metadata': encodeArray(this.metaData),
			'world': this.world.serialize(),
			'groundItems': this.groundItems.serialize(),
			'entities': this.entities.serialize(),
			'surfaceResources': this.surfaceResources.serialize(),
			'pathFinder': this.pathFinder.serialize(),
		}
	}

	public async advanceActivities() {
		if (this.isRunningLogic) throw new Error()
		this.isRunningLogic = true
		this.metaData[MetadataField.CurrentTick]++

		this.pathFinder.tick(this)

		const container = this.entities
		if (isInWorker)
			this.mutex.enter(Lock.Update)
		else
			await this.mutex.enterAsync(Lock.Update)

		for (const entity of iterateOverEntitiesWithActivity(container)) {
			const currentActivity = (container.withActivities.rawData)[entity.withActivity + DataOffsetWithActivity.CurrentId]! as ActivityId

			requireActivity(currentActivity).perform(this, entity)
		}

		if (container.buffersChanged) {
			container.buffersChanged = false
			this.stateBroadcastCallback()
		}

		this.mutex.unlock(Lock.Update)

		this.isRunningLogic = false
	}
}
