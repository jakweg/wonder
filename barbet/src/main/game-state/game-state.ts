import SeededRandom from '@seampan/seeded-random'
import { GameMutex, isInWorker } from '@utils/game-mutex'
import { decodeArray, encodeArray } from '@utils/persistance/serializers'
import { createNewBuffer } from '@utils/shared-memory'
import { UpdateDebugDataCollector } from '@utils/worker/debug-stats/update'
import { UpdatePhase } from '@utils/worker/debug-stats/update-phase'
import { ActivityId, getActivityPerformFunction } from './activities'
import { DelayedComputer, deserializeDelayedComputer } from './delayed-computer'
import { DataOffsetWithActivity } from './entities/data-offsets'
import EntityContainer from './entities/entity-container'
import { findAllNotSuspendedEntitiesWithActivity } from './entities/queries/with-activity'
import { GroundItemsIndex } from './ground-items-index'
import { execute, ScheduledAction } from './scheduled-actions'
import { ReceiveActionsQueue } from './scheduled-actions/queue'
import { SurfaceResourcesIndex } from './surface-resources/surface-resources-index'
import { TileMetaDataIndex } from './tile-meta-data-index'
import { World } from './world/world'

export interface GameState {
  readonly metaData: Int32Array
  readonly world: World
  readonly groundItems: GroundItemsIndex
  readonly entities: EntityContainer
  readonly tileMetaDataIndex: TileMetaDataIndex
  readonly surfaceResources: SurfaceResourcesIndex

  readonly currentTick: number
}

export const enum MetadataField {
  CurrentTick,
  LastWorldChange,
  LastBuildingsChange,
  SIZE,
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
    public readonly seededRandom: SeededRandom,
    private readonly mutex: GameMutex,
    private readonly stateBroadcastCallback: () => void,
  ) {}

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
    seededRandom: SeededRandom,
    mutex: GameMutex,
    stateBroadcastCallback: () => void,
  ): GameStateImplementation {
    return new GameStateImplementation(
      new Int32Array(createNewBuffer(MetadataField.SIZE * Int32Array.BYTES_PER_ELEMENT)),
      world,
      groundItems,
      entities,
      tileMetaDataIndex,
      delayedComputer,
      surfaceResources,
      seededRandom,
      mutex,
      stateBroadcastCallback,
    )
  }

  public static deserialize(
    object: any,
    mutex: GameMutex,
    stateBroadcastCallback: () => void,
  ): GameStateImplementation {
    const world = World.deserialize(object['world'])
    const tileMetaDataIndex = TileMetaDataIndex.deserialize(object['tileMetaDataIndex'], world.rawHeightData)
    return new GameStateImplementation(
      decodeArray(object['metadata'], true, Int32Array),
      world,
      GroundItemsIndex.deserialize(object['groundItems']),
      EntityContainer.deserialize(object['entities']),
      tileMetaDataIndex,
      deserializeDelayedComputer(object['delayedComputer']),
      SurfaceResourcesIndex.deserialize(object['surfaceResources']),
      SeededRandom.fromSeed(object['random']),
      mutex,
      stateBroadcastCallback,
    )
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
    if (this.delayedComputer == null) throw new Error('Missing delayedComputer')
    return {
      'metadata': encodeArray(this.metaData),
      'world': this.world.serialize(),
      'groundItems': this.groundItems.serialize(),
      'entities': this.entities.serialize(),
      'surfaceResources': this.surfaceResources.serialize(),
      'tileMetaDataIndex': this.tileMetaDataIndex.serialize(),
      'delayedComputer': this.delayedComputer.serialize(),
      'random': this.seededRandom.getCurrentSeed(),
    }
  }

  public async advanceActivities(additionalActions: ScheduledAction[], stats: UpdateDebugDataCollector) {
    if (this.isRunningLogic) throw new Error()
    this.isRunningLogic = true
    stats.frames.frameStarted()

    stats.timeMeter.beginSession(UpdatePhase.LockMutex)
    if (isInWorker) this.mutex.enterForUpdate()
    else await this.mutex.enterForUpdateAsync()

    const currentTick = ++this.metaData[MetadataField.CurrentTick] | 0

    stats.timeMeter.nowStart(UpdatePhase.ScheduledActions)
    for (const action of additionalActions) {
      execute(action, this)
    }

    stats.timeMeter.nowStart(UpdatePhase.EntityActivities)
    const container = this.entities
    const rawData = container.withActivities.rawData
    findAllNotSuspendedEntitiesWithActivity(
      this.entities,
      entity => {
        const currentActivity = rawData[entity.withActivity + DataOffsetWithActivity.CurrentActivityId]! as ActivityId

        const perform = getActivityPerformFunction(currentActivity)
        perform(this, entity)
      },
      currentTick,
    )

    stats.timeMeter.nowStart(UpdatePhase.ActionsQueue)
    this.actionsQueue.executeAllUntilEmpty(this)

    if (container.buffersChanged) {
      container.buffersChanged = false
      this.stateBroadcastCallback()
    }

    this.mutex.exitUpdate()
    this.isRunningLogic = false

    stats.timeMeter.nowStart(UpdatePhase.DelayedComputer)
    this.delayedComputer.tick(this)

    stats.timeMeter.endSessionAndGetRawResults()
    stats.frames.frameEnded()
  }
}
