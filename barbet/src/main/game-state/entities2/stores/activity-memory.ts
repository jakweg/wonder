import { Store } from './store'
import StoreFactory from './factory'

const STORE_NAME = 'activity-memory'

const enum Offsets {
  SIZE = 20,
}

export default (factory: StoreFactory) => {
  const arrayType = Uint8Array
  const store = Store.createNew<Offsets, typeof arrayType>(STORE_NAME, factory, [], Offsets.SIZE, arrayType)

  return {}
}
