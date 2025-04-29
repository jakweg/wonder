import { Store } from './store'
import StoreFactory from './factory'

const STORE_NAME = 'drawable'

const enum Offsets {
  SIZE = 10,
  ModelId = SIZE - 1,
}

export default (factory: StoreFactory) => {
  const arrayType = Uint8Array
  const store = Store.createNew<Offsets, typeof arrayType>(STORE_NAME, factory, [], Offsets.SIZE, arrayType)

  return {}
}
