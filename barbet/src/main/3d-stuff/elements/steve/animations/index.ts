import { registerClipRecord } from '@3d/skeletal/pose-atlas'
import {
  getSteveAnimationDuration,
  isSteveAnimationLooping,
  SteveAnimationId,
} from '@game/new-entities/stores/steve-animation-id'
import { steveSkeleton } from '../mesh'
import { idleClip } from './idle'
import { walkClip, walkDownClip, walkUpClip } from './walk'
import { wavingHandLeftClip, wavingHandRightClip } from './waving-hand'

export const stevePoseAtlasAllocation = registerClipRecord(
  steveSkeleton,
  SteveAnimationId.SIZE,
  {
    [SteveAnimationId.Idle]: idleClip,
    [SteveAnimationId.Walk]: walkClip,
    [SteveAnimationId.WalkUp]: walkUpClip,
    [SteveAnimationId.WalkDown]: walkDownClip,
    [SteveAnimationId.WavingHandRight]: wavingHandRightClip,
    [SteveAnimationId.WavingHandLeft]: wavingHandLeftClip,
  },
  getSteveAnimationDuration,
  isSteveAnimationLooping,
)
