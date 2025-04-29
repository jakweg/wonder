import { Store } from './store'
import StoreFactory from './factory'

const STORE_NAME = 'interruptions'

const enum Offsets {
  Type,
  ValueA,
  ValueB,
  ValueC,
  SIZE,
}

export default (factory: StoreFactory) => {
  const arrayType = Int32Array
  const store = Store.createNew<Offsets, typeof arrayType>(STORE_NAME, factory, [], Offsets.SIZE, arrayType)

  return {}
}
