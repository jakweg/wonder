import { EntityArchetype } from './archetypes'
import { constructFullEntityId, EntityId, getArchetypeFromEntityId } from './entity'
import StoreFactory from './stores/factory'
import PositionStore from './stores/position'
import ChangeIdStore from './stores/change-id'
import { Store } from './stores/store'

export class EntityContainer {
  private constructor(
    private readonly factory: StoreFactory,

    public readonly generationIds = ChangeIdStore(factory),
    public readonly positions = PositionStore(factory),
  ) {}

  private static usingFactory(factory: StoreFactory) {
    return new EntityContainer(factory)
  }

  public static createNew() {
    const factory = StoreFactory.createNew()
    return this.usingFactory(factory)
  }
  public static fromReceived(object: any) {
    const factory = StoreFactory.fromReceived(object)
    return this.usingFactory(factory)
  }
  public static deserialize(saved: any) {
    const factory = StoreFactory.deserialize(saved)
    return this.usingFactory(factory)
  }

  public serialize() {
    return this.factory.serialize()
  }
  public pass() {
    return this.factory.pass()
  }

  public createNewEntity(archetype: EntityArchetype): EntityId | null {
    const index = this.generationIds.findAvailableEntityIndex(archetype)
    if (index === null) return null

    const generationId = this.generationIds.markEntityIndexAsNextAliveEntityAndGetGenerationId(archetype, index)

    return constructFullEntityId(archetype, generationId, index)
  }

  public markEntityAsDead(entity: EntityId): void {
    this.generationIds.markEntityAsDead(entity)
  }

  public isEntityAlive(entity: EntityId) {
    const archetype = getArchetypeFromEntityId(entity)
    if ((archetype === archetype) | 0) return this.generationIds.isEntityStillAlive(entity)
  }

  public findAllNotSuspendedWithActivity() {
    this.generationIds.markEntityAsDead
  }

  // findAllNotSuspendedEntitiesWithActivity = (
  //   currentTick: number,
  //   forEach: (entity: any) => void,
  // ): void => {

  //   // const filterTraits = EntityTrait.Drawable | EntityTrait.Position | EntityTrait.WithActivity
  //   // const record = createEmptyTraitRecord()
  //   // const rawData = container.ids.rawData
  //   // const activitiesData = container.withActivities.rawData

  //   // let indexDrawable = 0
  //   // let indexPosition = 0
  //   // let withActivity = 0
  //   // let interruptible = 0

  //   // for (let i = 0, l = container.ids.size; i < l; i++) {
  //   //   const idIndex = i * DataOffsetIds.SIZE
  //   //   const traits = rawData[idIndex + DataOffsetIds.Traits]!

  //   //   if (hasTrait(traits, filterTraits)) {
  //   //     const withActivityIndex = withActivity * DataOffsetWithActivity.SIZE
  //   //     const suspendedUntil = activitiesData[withActivityIndex + DataOffsetWithActivity.SuspendUntilTick]! | 0

  //   //     if (suspendedUntil <= currentTick) {
  //   //       record.thisId = rawData[idIndex + DataOffsetIds.ID]!
  //   //       record.thisTraits = traits

  //   //       record.drawable = indexDrawable
  //   //       record.position = indexPosition
  //   //       record.withActivity = withActivityIndex
  //   //       record.activityMemory = withActivity * ACTIVITY_MEMORY_SIZE
  //   //       record.interruptible = interruptible
  //   //       forEach(record)
  //   //     }
  //   //   }

  //   //   if (hasTrait(traits, EntityTrait.Drawable)) indexDrawable += DataOffsetDrawables.SIZE
  //   //   if (hasTrait(traits, EntityTrait.Position)) indexPosition += DataOffsetPositions.SIZE
  //   //   if (hasTrait(traits, EntityTrait.Interruptible)) interruptible += DataOffsetInterruptible.SIZE
  //   //   if (hasTrait(traits, EntityTrait.WithActivity)) withActivity++
  //   // }
  // }
}
