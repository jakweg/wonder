import TypedArray from '@seampan/typed-array'
import { DefinedModelWithAttributes } from './builder'

export interface GenericEntityModel<Pose extends number> {
  posesCount: Pose
  buildPose: (which: Pose) => DefinedModelWithAttributes<TypedArray, any>
}
