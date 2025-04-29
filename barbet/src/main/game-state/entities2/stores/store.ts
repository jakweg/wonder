import { EntityArchetype } from '../archetypes'
import { EntityId, getArchetypeFromEntityId, getIndexFromEntityId } from '../entity'
import StoreFactory from './factory'

function numberOfSetBits(i: number) {
  i = (i | 0) - ((i >> 1) & 0x55555555)
  i = (i & 0x33333333) + ((i >> 2) & 0x33333333)
  i = (i + (i >> 4)) & 0x0f0f0f0f
  i *= 0x01010101
  return i >> 24
}

export const MAX_ENTITIES_PER_ARCHETYPE = 1000

type AnyIntArray =
  | Uint8ArrayConstructor
  | Int8ArrayConstructor
  | Uint16ArrayConstructor
  | Int16ArrayConstructor
  | Uint32ArrayConstructor
  | Int32ArrayConstructor

export class Store<Field extends number, Storage extends AnyIntArray> {
  private constructor(
    protected readonly archetypesOffsetsMasked: number,
    protected readonly fieldsPerEntity: Field,
    protected readonly rawStorage: InstanceType<Storage>,
  ) {}

  public pass() {
    return {
      archetypesOffsetsMasked: this.archetypesOffsetsMasked,
      fieldsPerEntity: this.fieldsPerEntity,
      rawStorage: this.rawStorage,
    }
  }

  public static fromReceived(obj: any) {
    return new Store(obj.archetypesOffsetsMasked, obj.fieldsPerEntity, obj.rawStorage)
  }

  public static createNew<F extends number, Storage extends AnyIntArray>(
    name: string,
    factory: StoreFactory,
    archetypes: Array<EntityArchetype>,
    fieldsPerEntity: F,
    arrayConstructor: Storage,
  ) {
    const reducedToBitMask = archetypes.reduce((p, c) => p | (1 << c), 0)

    const byteLength =
      MAX_ENTITIES_PER_ARCHETYPE *
      fieldsPerEntity *
      arrayConstructor['BYTES_PER_ELEMENT'] *
      numberOfSetBits(reducedToBitMask)
    const buffer = factory.getBufferForStore(name, byteLength)
    const storage = new arrayConstructor(buffer) as any as InstanceType<Storage>

    return new Store<F, Storage>(reducedToBitMask, fieldsPerEntity, storage)
  }

  public isArchetypeSupportedByThisStore(archetype: EntityArchetype): boolean {
    const archetypeAsBitMask = 1 << archetype
    return (this.archetypesOffsetsMasked & archetypeAsBitMask) === archetypeAsBitMask
  }

  public isEntitySupportedByThisStore(entityFullId: EntityId): boolean {
    return this.isArchetypeSupportedByThisStore(getIndexFromEntityId(entityFullId))
  }

  public calculateArchetypeOffset(archetype: EntityArchetype): number {
    const howManyArchetypesToSkip =
      numberOfSetBits((this.archetypesOffsetsMasked << (32 - archetype)) >>> (32 - archetype)) - 1

    const startOfThisArchetype = (howManyArchetypesToSkip * MAX_ENTITIES_PER_ARCHETYPE * this.fieldsPerEntity) | 0

    return startOfThisArchetype | 0
  }

  public calculateEntityOffset(entityFullId: EntityId): number {
    const archetype = getArchetypeFromEntityId(entityFullId)
    const index = getIndexFromEntityId(entityFullId)

    const indexInThisArchetype = (index * this.fieldsPerEntity) | 0

    return (this.calculateArchetypeOffset(archetype) + indexInThisArchetype) | 0
  }

  public calculateFieldOfEntityOffset(entityFullId: EntityId, field: Field): number {
    return this.calculateEntityOffset(entityFullId) + field
  }

  public get(entityFullId: EntityId, field: Field) {
    return this.rawStorage[this.calculateFieldOfEntityOffset(entityFullId, field)]!
  }

  public set(entityFullId: EntityId, field: Field, value: number) {
    this.rawStorage[this.calculateFieldOfEntityOffset(entityFullId, field)] = value
  }

  public getRawStorage() {
    return this.rawStorage
  }
}
