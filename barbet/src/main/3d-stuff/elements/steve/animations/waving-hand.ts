import { defineAnimationClip, deg, KeyframeEasing, mirrorClipLeftRight, oscillateBoneTrack } from '@3d/skeletal/clip'
import { STEVE_MIRROR_BONES, SteveBoneName } from '../mesh'

export const wavingHandRightClip = defineAnimationClip<SteveBoneName>({
  blendInTicks: 5,
  ambientWeight: 1.0,
  tracks: {
    Head: [
      { at: 0, pitch: 0 },
      { at: 0.18, pitch: deg(4), easing: KeyframeEasing.Smoothstep },
      { at: 0.82, pitch: deg(4) },
      { at: 1, pitch: 0, easing: KeyframeEasing.Smoothstep },
    ],
    RightUpperArm: [
      { at: 0, pitch: 0, roll: 0 },
      { at: 0.18, pitch: deg(16), roll: deg(-117), easing: KeyframeEasing.Smoothstep },
      { at: 0.82, pitch: deg(16), roll: deg(-117) },
      { at: 1, pitch: 0, roll: 0, easing: KeyframeEasing.Smoothstep },
    ],
    RightForearm: oscillateBoneTrack({
      startAt: 0.18,
      endAt: 0.82,
      halfCycles: 7,
      base: { pitch: deg(7), roll: deg(-45) },
      amplitude: { roll: deg(-22) },
    }),
  },
})

export const wavingHandLeftClip = mirrorClipLeftRight(wavingHandRightClip, STEVE_MIRROR_BONES)
