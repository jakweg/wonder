import { defineAnimationClip } from '@3d/skeletal/clip'
import { SteveBoneName } from '../mesh'

export const idleClip = defineAnimationClip<SteveBoneName>({
  blendInTicks: 5,
  ambientWeight: 1.0,
})
