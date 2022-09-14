import { GameMutex, isInWorker } from '../util/game-mutex'
import { decodeArray, encodeArray } from '../util/persistance/serializers'
import { createNewBuffer } from '../util/shared-memory'
import { ActivityId, getActivityPerformFunction } from './activities'
import { DelayedComputer, deserializeDelayedComputer } from './delayed-computer'
import EntityContainer from './entities/entity-container'
import { iterateOverEntitiesWithActivity } from './entities/queries'
import { DataOffsetWithActivity } from './entities/traits'
import { GroundItemsIndex } from './ground-items-index'
import { execute, ScheduledAction } from './scheduled-actions'
import { ReceiveActionsQueue } from './scheduled-actions/queue'
import { SurfaceResourcesIndex } from './surface-resources/surface-resources-index'
import { TileMetaDataIndex } from './tile-meta-data-index'
import { World } from './world/world'

export interface GameState {
	readonly metaData: Int32Array,
	readonly world: World,
	readonly groundItems: GroundItemsIndex,
	readonly entities: EntityContainer,
	readonly tileMetaDataIndex: TileMetaDataIndex,
	readonly surfaceResources: SurfaceResourcesIndex,

	readonly currentTick: number
}

export const createGameStateForRenderer = (object: any): GameState => {
	return {
		metaData: new Int32Array(object.metadata),
		world: World.fromReceived(object.world),
		groundItems: GroundItemsIndex.fromReceived(object.groundItems),
		entities: EntityContainer.fromReceived(object.entities),
		tileMetaDataIndex: TileMetaDataIndex.fromReceived(object.tileMetaDataIndex),
		surfaceResources: SurfaceResourcesIndex.fromReceived(object.surfaceResources),

		get currentTick(): number {
			return this.metaData[MetadataField.CurrentTick]!
		},
	}
}


export const enum MetadataField {
	CurrentTick,
	LastWorldChange,
	LastBuildingsChange,
	SIZE
}

export class GameStateImplementation implements GameState {
	/** @deprecated remove it? it may be used in the future */
	public readonly actionsQueue: ReceiveActionsQueue = ReceiveActionsQueue.create()
	private isRunningLogic: boolean = false

	private constructor(
		public readonly metaData: Int32Array,
		public readonly world: World,
		public readonly groundItems: GroundItemsIndex,
		public readonly entities: EntityContainer,
		public readonly tileMetaDataIndex: TileMetaDataIndex,
		public readonly delayedComputer: DelayedComputer,
		public readonly surfaceResources: SurfaceResourcesIndex,
		private readonly mutex: GameMutex,
		private readonly stateBroadcastCallback: () => void) {
	}

	public get currentTick(): number {
		return this.metaData[MetadataField.CurrentTick]!
	}

	public static createNew(
		world: World,
		groundItems: GroundItemsIndex,
		entities: EntityContainer,
		tileMetaDataIndex: TileMetaDataIndex,
		delayedComputer: DelayedComputer,
		surfaceResources: SurfaceResourcesIndex,
		mutex: GameMutex,
		stateBroadcastCallback: () => void): GameStateImplementation {
		return new GameStateImplementation(
			new Int32Array(createNewBuffer(MetadataField.SIZE * Int32Array.BYTES_PER_ELEMENT)),
			world, groundItems, entities,
			tileMetaDataIndex, delayedComputer, surfaceResources,
			mutex, stateBroadcastCallback)
	}

	public static deserialize(object: any, mutex: GameMutex, stateBroadcastCallback: () => void): GameStateImplementation {
		const world = World.deserialize(object['world'])
		const tileMetaDataIndex = TileMetaDataIndex.deserialize(object['tileMetaDataIndex'], world.rawHeightData)
		return new GameStateImplementation(
			decodeArray(object['metadata'], true, Int32Array),
			world,
			GroundItemsIndex.deserialize(object['groundItems']),
			EntityContainer.deserialize(object['entities']),
			tileMetaDataIndex, deserializeDelayedComputer(object['delayedComputer']),
			SurfaceResourcesIndex.deserialize(object['surfaceResources']),
			mutex, stateBroadcastCallback)
	}

	public passForRenderer(): unknown {
		return {
			metadata: this.metaData['buffer'],
			world: this.world.pass(),
			groundItems: this.groundItems.pass(),
			entities: this.entities.pass(),
			surfaceResources: this.surfaceResources.pass(),
			tileMetaDataIndex: this.tileMetaDataIndex.pass(),
		}
	}

	public serialize(): any {
		if (this.delayedComputer == null)
			throw new Error('Missing delayedComputer')
		return {
			'metadata': encodeArray(this.metaData),
			'world': this.world.serialize(),
			'groundItems': this.groundItems.serialize(),
			'entities': this.entities.serialize(),
			'surfaceResources': this.surfaceResources.serialize(),
			'tileMetaDataIndex': this.tileMetaDataIndex.serialize(),
			'delayedComputer': this.delayedComputer.serialize(),
		}
	}

	public async advanceActivities(additionalActions: ScheduledAction[]) {
		if (this.isRunningLogic) throw new Error()
		this.isRunningLogic = true

		if (isInWorker)
			this.mutex.enterForUpdate()
		else
			await this.mutex.enterForUpdateAsync()

		this.metaData[MetadataField.CurrentTick]++

		for (const action of additionalActions) {
			execute(action, this)
		}

		const container = this.entities
		for (const entity of iterateOverEntitiesWithActivity(container)) {
			const currentActivity = (container.withActivities.rawData)[entity.withActivity + DataOffsetWithActivity.CurrentId]! as ActivityId

			const perform = getActivityPerformFunction(currentActivity)
			perform?.(this, entity)
		}

		this.actionsQueue.executeAllUntilEmpty(this)

		if (container.buffersChanged) {
			container.buffersChanged = false
			this.stateBroadcastCallback()
		}

		this.mutex.exitUpdate()
		this.isRunningLogic = false

		this.delayedComputer.tick(this)
	}
}
