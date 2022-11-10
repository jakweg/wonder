import TypedArray from '@seampan/typed-array'
import { DefinedModelWithAttributes } from './builder'
import slime from './entity/slime'

const enum ModelId {
  Slime,
  SIZE,
}

export interface ModelPrototype<Pose extends number> {
  posesCount: Pose
  buildPose: (which: Pose) => DefinedModelWithAttributes<TypedArray>
}

export const getModelPrototype = (which: ModelId): ModelPrototype<number> => {
  switch (which) {
    case ModelId.Slime:
      return slime

    default:
      throw new Error()
  }
}

export default ModelId
