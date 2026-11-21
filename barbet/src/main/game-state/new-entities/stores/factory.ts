import GameStatePiece, { PASS, SERIALIZE } from '@game/game-state-piece'
import EntityId, { entityId_extractIndex, entityId_extractKind } from '@game/new-entities/id'
import { EntityKind, getMaxEntitiesByKind } from '@game/new-entities/kind'
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

type UnionToIntersection<U> = (U extends any ? (value: U) => void : never) extends (value: infer I) => void ? I : never

type StoreRead<S> = S extends StoreDescription<infer R, any> ? R : never
type StoreWrite<S> = S extends StoreDescription<any, infer W> ? W : never

export type FlattenedMergedStore<
  RO extends boolean,
  T extends readonly StoreDescription<any, any>[],
> = UnionToIntersection<StoreRead<T[number]>> &
  ([RO] extends [true] ? unknown : UnionToIntersection<StoreWrite<T[number]>>)

type TypedArrayConstructor =
  | typeof Float32Array
  | typeof Uint16Array
  | typeof Uint32Array
  | typeof Int32Array
  | typeof Uint8Array
  | typeof Int8Array

type DataBufferSpec = { internalType: TypedArrayConstructor; fieldsPerEntity: number }

type DataMapCodec<T> = {
  encode: (value: T) => unknown
  decode: (encoded: unknown) => T
}

type DataMapSpec<T = unknown> = DataMapCodec<T> | { value: T }

type ExtractDataMapValue<S> = S extends DataMapCodec<infer T> ? T : S extends { value: infer T } ? T : unknown

type DataBufferImplementationSpec = {
  getValueForEntity_orThrow(entityId: EntityId, field: number): number
  getValueForEntity_orElse(entityId: EntityId, field: number, fallbackValue: number): number

  setValueForEntity_orThrow(entityId: EntityId, field: number, newValue: number): void
}

export interface StoreInitializer extends GameStatePiece {
  prepareStorage<
    D extends Record<string, DataBufferSpec> = {},
    M extends Record<string, DataMapSpec<any>> = {},
  >(options: {
    supportedKinds: EntityKind[]
    dataBuffers?: D
    dataMaps?: M
  }): {
    isKindSupported: (kind: EntityKind) => boolean
    isEntitySupported: (entityId: EntityId) => boolean
    storage: {
      [key in keyof D]: DataBufferImplementationSpec
    } & {
      [key in keyof M]: Map<EntityId, ExtractDataMapValue<M[key]>>
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
  const isRenderer = Boolean(options?.rendererReceived)
  let incomingBuffers: SharedArrayBuffer[] = []
  let incomingMaps: [EntityId, unknown][][] = []
  if (options?.rendererReceived) {
    incomingBuffers = [...options.rendererReceived.buffers]
  } else if (options?.serializedState) {
    incomingBuffers = options.serializedState['buffers'].map(
      (b: any) => decodeArray(b, true, Uint8Array)['buffer'] as unknown as SharedArrayBuffer,
    )
    if (Array.isArray(options.serializedState['maps'])) {
      incomingMaps = [...options.serializedState['maps']]
    }
  }

  const ownedBuffers: SharedArrayBuffer[] = []
  const ownedMaps: { serialize: () => [EntityId, unknown][] }[] = []

  return {
    [PASS]() {
      return {
        buffers: ownedBuffers,
      }
    },
    [SERIALIZE]() {
      return {
        'buffers': ownedBuffers.map(b => encodeArray(new Uint8Array(b))),
        'maps': ownedMaps.map(entry => entry.serialize()),
      }
    },
    prepareStorage(options) {
      validateKinds(options.supportedKinds)

      const isKindSupported = (kind: EntityKind) => {
        return options.supportedKinds.includes(kind)
      }
      const isEntitySupported = (entityId: EntityId) => {
        const kind = entityId_extractKind(entityId)
        return isKindSupported(kind)
      }

      const storage: Record<string, unknown> = {}
      const bufferEntries = Object.entries(options.dataBuffers ?? {})
      const mapEntries = Object.entries(options.dataMaps ?? {})

      if (bufferEntries.length > 0) {
        const offsets = calculateOffsetsForEntityKinds(options.supportedKinds)

        for (const [key, value_] of bufferEntries) {
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

          storage[key] = createDataBufferImplementation(array, mappedOffsets, value.fieldsPerEntity, isKindSupported)
        }
      }

      for (const [key, value_] of mapEntries) {
        if (storage[key] !== undefined) {
          throw new Error(`Duplicate storage key "${key}" in dataBuffers and dataMaps`)
        }
        const spec = value_ as DataMapSpec<unknown> & { encode: any; decode: any }
        if (Boolean(spec.encode) !== Boolean(spec.decode)) {
          throw new Error(`Data map "${key}" must provide both encode and decode, or neither`)
        }

        if (isRenderer) {
          storage[key] = Symbol('not supported in renderer')
          continue
        }

        const map = new Map<EntityId, unknown>()
        const incomingEntries = incomingMaps.shift()
        if (incomingEntries) {
          for (const [rawEntityId, rawValue] of incomingEntries) {
            const entityId = rawEntityId as EntityId
            const kind = entityId_extractKind(entityId)
            if (!isKindSupported(kind)) {
              throw new Error(`Kind ${kind} not supported in this data store`)
            }
            const decodedValue = spec.decode ? spec.decode(rawValue) : rawValue
            map.set(entityId, decodedValue)
          }
        }

        ownedMaps.push({
          serialize() {
            const entries: [EntityId, unknown][] = []
            for (const [entityId, value] of map.entries()) {
              const encodedValue = spec.encode
                ? spec.encode(value)
                : value === undefined
                  ? undefined
                  : JSON.parse(JSON.stringify(value))
              entries.push([entityId, encodedValue])
            }
            return entries
          },
        })

        storage[key] = map
      }

      return {
        isKindSupported,
        isEntitySupported,
        storage: storage as any,
      }
    },
  }
}

/**
 * Returns how much space to reserve for entities of such kind
 */
const calculateOffsetsForEntityKinds = (
  allowedKinds: readonly EntityKind[],
): Readonly<{ [key in EntityKind]: number }> => {
  const offsetsArray: number[] = []

  let offsetSoFar = 0
  for (let i = 0; i <= EntityKind.SIZE; ++i) {
    offsetsArray.push(offsetSoFar)

    if (allowedKinds.includes(i)) {
      const max = getMaxEntitiesByKind(i)
      offsetSoFar += max
    }
  }

  return offsetsArray as any
}
