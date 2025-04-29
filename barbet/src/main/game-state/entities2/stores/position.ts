import { createNewBuffer } from '@utils/shared-memory'
import { EntityArchetype } from '../archetypes'
import { Store } from './store'
import StoreFactory from './factory'
import { EntityId } from '../entity'

const STORE_NAME = 'position'

export const enum Position {
  PositionX,
  PositionY,
  PositionZ,
  SIZE,
}

export default (factory: StoreFactory) => {
  const store = Store.createNew<Position, Int32ArrayConstructor>(STORE_NAME, factory, [], Position.SIZE, Int32Array)

  const array = store.getRawStorage()

  return {
    queryPosition(entity: EntityId): [number, number, number] {
      // const x = store.get(entity, Position.X)
      // const y = store.get(entity, Position.Y)
      // const z = store.get(entity, Position.Z)

      const offset = store.calculateEntityOffset(entity)
      const x = array[offset + Position.PositionX]!
      const y = array[offset + Position.PositionY]!
      const z = array[offset + Position.PositionZ]!

      return [x, y, z]
    },
  }
}
