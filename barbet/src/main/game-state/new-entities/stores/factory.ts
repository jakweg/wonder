import GameStatePiece, { PASS, SERIALIZE } from '@game/game-state-piece'
import EntityId, { entityId_extractIndex, entityId_extractKind } from '@game/new-entities/id'
import { EntityKind, calculateOffsetsForEntityKinds } from '@game/new-entities/kind'
import { decodeArray, encodeArray } from '@utils/persistence/serializers'
import { createNewBuffer } from '@utils/shared-memory'

export interface StoreLifecycle {
  onEntityAllocated?: (entityId: EntityId) => void
  onEntityAboutToRemove?: (entityId: EntityId) => void
}

export interface StoreDescription<R extends object, W extends object> {
  read: R
  write: W
  lifecycle?: StoreLifecycle
}

export type FlattenedMergedStore<
  RO extends boolean,
  T extends readonly StoreDescription<any, any>[],
> = T extends readonly [StoreDescription<infer R, infer W>, ...infer Rest extends readonly StoreDescription<any, any>[]]
  ? ([RO] extends [true] ? R : R & W) & FlattenedMergedStore<RO, Rest>
  : {}

type TypedArrayConstructor =
  | typeof Float32Array
  | typeof Uint16Array
  | typeof Uint32Array
  | typeof Int32Array
  | typeof Uint8Array
  | typeof Int8Array

type DataBufferSpec = { internalType: TypedArrayConstructor; fieldsPerEntity: number }

type DataBufferImplementationSpec = {
  getValueForEntity_orThrow(entityId: EntityId, field: number): number
  getValueForEntity_orElse(entityId: EntityId, field: number, fallbackValue: number): number

  setValueForEntity_orThrow(entityId: EntityId, field: number, newValue: number): void
}

export interface StoreInitializer extends GameStatePiece {
  prepareStorage<D extends {}>(options: {
    supportedKinds: EntityKind[]
    dataBuffers: {
      [key in keyof D]: DataBufferSpec
    }
  }): {
    isKindSupported: (kind: EntityKind) => boolean
    isEntitySupported: (entityId: EntityId) => boolean
    storage: {
      [key in keyof D]: DataBufferImplementationSpec
    }
  }
}

const validateKinds = (supportedKinds: EntityKind[]) => {
  if (supportedKinds.length === 0) throw new Error()
  if (new Set(supportedKinds)['size'] !== supportedKinds.length) throw new Error()
  if (supportedKinds.includes(EntityKind.Invalid) || supportedKinds.includes(EntityKind.SIZE)) throw new Error()
}

const createDataBufferImplementation = (
  array: InstanceType<TypedArrayConstructor>,
  offsets: readonly number[],
  fieldsPerEntity: number,
  isKindSupported: (kind: EntityKind) => boolean,
): DataBufferImplementationSpec => {
  return {
    getValueForEntity_orElse(entityId, field, fallbackValue) {
      const kind = entityId_extractKind(entityId)
      if (!isKindSupported(kind)) return fallbackValue
      const index = entityId_extractIndex(entityId)

      const absoluteIndex = offsets[kind]! + index * fieldsPerEntity + field
      return array[absoluteIndex]!
    },
    getValueForEntity_orThrow(entityId, field) {
      const kind = entityId_extractKind(entityId)
      if (!isKindSupported(kind)) throw new Error(`Kind ${kind} not supported in this data store`)
      const index = entityId_extractIndex(entityId)

      const absoluteIndex = offsets[kind]! + index * fieldsPerEntity + field
      return array[absoluteIndex]!
    },
    setValueForEntity_orThrow(entityId, field, newValue) {
      const kind = entityId_extractKind(entityId)
      if (!isKindSupported(kind)) throw new Error(`Kind ${kind} not supported in this data store`)
      const index = entityId_extractIndex(entityId)

      const absoluteIndex = offsets[kind]! + index * fieldsPerEntity + field
      array[absoluteIndex] = newValue
    },
  } satisfies DataBufferImplementationSpec
}

export const createEntitiesStorageFactory = (
  options: { serializedState?: any; rendererReceived?: any } | null,
): StoreInitializer => {
  let incomingBuffers: SharedArrayBuffer[] = []
  if (options?.rendererReceived) {
    incomingBuffers = [...options.rendererReceived.buffers]
  } else if (options?.serializedState) {
    incomingBuffers = options.serializedState['buffers'].map(
      (b: any) => decodeArray(b, true, Uint8Array)['buffer'] as unknown as SharedArrayBuffer,
    )
  }

  const ownedBuffers: SharedArrayBuffer[] = []

  return {
    [PASS]() {
      return {
        buffers: ownedBuffers,
      }
    },
    [SERIALIZE]() {
      return {
        'buffers': ownedBuffers.map(b => encodeArray(new Uint8Array(b))),
      }
    },
    prepareStorage(options) {
      validateKinds(options.supportedKinds)
      const offsets = calculateOffsetsForEntityKinds(options.supportedKinds)

      const isKindSupported = (kind: EntityKind) => {
        return options.supportedKinds.includes(kind)
      }
      const isEntitySupported = (entityId: EntityId) => {
        const kind = entityId_extractKind(entityId)
        return isKindSupported(kind)
      }

      const storage = Object.fromEntries(
        Object.entries(options.dataBuffers).map(([key, value_]) => {
          const value = value_ as DataBufferSpec
          if (value.fieldsPerEntity !== (value.fieldsPerEntity | 0) || value.fieldsPerEntity === 0) throw new Error()

          const bytesSize = value.internalType['BYTES_PER_ELEMENT'] * value.fieldsPerEntity * offsets[EntityKind.SIZE]
          let internalBuffer = incomingBuffers.shift()
          if (!internalBuffer) {
            internalBuffer = createNewBuffer(bytesSize)
          } else if (internalBuffer.byteLength !== bytesSize) {
            throw new Error(`Expected buffer of ${bytesSize} bytes, got ${internalBuffer.byteLength}`)
          }
          ownedBuffers.push(internalBuffer)
          // Invoking constructor of the array
          const array = new value.internalType(internalBuffer as unknown as ArrayBuffer)

          const mappedOffsets: number[] = []
          for (let i = 0; i < EntityKind.SIZE; ++i) {
            mappedOffsets.push((offsets as any)[i] * value.fieldsPerEntity)
          }

          const impl = createDataBufferImplementation(array, mappedOffsets, value.fieldsPerEntity, isKindSupported)

          return [key, impl]
        }),
      ) as any

      return {
        isKindSupported,
        isEntitySupported,
        storage,
      }
    },
  }
}
