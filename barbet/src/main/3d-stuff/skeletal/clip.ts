import { BoneRef, extractBoneRefKey } from './skeleton'

export const enum KeyframeEasing {
  Linear = 0,
  Smoothstep = 1,
  EaseIn = 2,
  EaseOut = 3,
  SineInOut = 4,
}

export interface BoneAngles {
  /** Rotation around local +Z (positive swings hanging limbs forward toward +X, or pitches head/torso up/back) */
  pitch: number
  /** Rotation around local +Y (positive turns +X toward -Z / entity's left) */
  yaw: number
  /** Rotation around local +X (positive abducts left limbs outward toward -Z; negative abducts right limbs toward +Z) */
  roll: number
}

export interface BoneKeyframe {
  readonly at: number
  readonly pitch?: number
  readonly yaw?: number
  readonly roll?: number
  readonly easing?: KeyframeEasing
}

export interface RootOffsetKeyframe {
  readonly at: number
  readonly x?: number
  readonly y?: number
  readonly z?: number
  readonly verticalBlocksOffset?: number
  readonly easing?: KeyframeEasing
}

export interface SampledClipPose<BoneName extends string> {
  localRootOffset: [number, number, number]
  verticalBlocksOffset: number
  readonly bones: Record<BoneName, BoneAngles>
}

export interface AnimationClipSpec<BoneName extends string> {
  /** Ticks to cross-fade from the outgoing pose when switching into this clip (default: 5) */
  readonly blendInTicks?: number
  /** True when the clip translates horizontally across 1 world tile from (progress - 1) to 0 */
  readonly stepMovement?: boolean
  /** Multiplier in [0, 1] applied to procedural idle breathing and eye saccades (default: 1.0) */
  readonly ambientWeight?: number
  /** Declarative root local offset + world vertical block offset keyframes */
  readonly rootOffset?: readonly RootOffsetKeyframe[]
  /** Declarative per-bone rotation keyframe tracks */
  readonly tracks?: Partial<Record<BoneName, readonly BoneKeyframe[]>>
  /** Optional bake-time evaluator (sampled once at startup into the GPU Pose Atlas alongside declarative tracks) */
  readonly evaluate?: (progress: number, pose: SampledClipPose<BoneName>) => void
}

/** Mangle-safe map of LeftBone -> `{ RightBone: true }` pairs for sagittal mirroring */
export type MirrorBoneMap<BoneName extends string> = Partial<Record<BoneName, BoneRef<BoneName>>>

export const deg = (degrees: number): number => (degrees * Math.PI) / 180

export const smoothstepScalar = (edge0: number, edge1: number, x: number): number => {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export const smoothPulseScalar = (
  riseStart: number,
  riseEnd: number,
  fallStart: number,
  fallEnd: number,
  x: number,
): number => smoothstepScalar(riseStart, riseEnd, x) * (1 - smoothstepScalar(fallStart, fallEnd, x))

const applyEasing = (t: number, easing: KeyframeEasing = KeyframeEasing.Linear): number => {
  const clamped = Math.max(0, Math.min(1, t))
  switch (easing) {
    case KeyframeEasing.Smoothstep:
      return clamped * clamped * (3 - 2 * clamped)
    case KeyframeEasing.EaseIn:
      return clamped * clamped
    case KeyframeEasing.EaseOut:
      return 1 - (1 - clamped) * (1 - clamped)
    case KeyframeEasing.SineInOut:
      return 0.5 - 0.5 * Math.cos(Math.PI * clamped)
    case KeyframeEasing.Linear:
      return clamped
  }
}

const sampleScalarTrack = <K extends { readonly at: number; readonly easing?: KeyframeEasing }>(
  keyframes: readonly K[],
  progress: number,
  readValue: (keyframe: K) => number,
): number => {
  if (keyframes.length === 0) return 0
  const first = keyframes[0]!
  if (progress <= first.at) return readValue(first)

  for (let i = 1; i < keyframes.length; ++i) {
    const next = keyframes[i]!
    if (progress <= next.at) {
      const prev = keyframes[i - 1]!
      const span = next.at - prev.at
      const rawT = span > 1e-6 ? (progress - prev.at) / span : 1
      const easedT = applyEasing(rawT, next.easing)
      const prevValue = readValue(prev)
      return prevValue + (readValue(next) - prevValue) * easedT
    }
  }

  return readValue(keyframes[keyframes.length - 1]!)
}

export const defineAnimationClip = <BoneName extends string>(
  spec: AnimationClipSpec<BoneName>,
): AnimationClipSpec<BoneName> => spec

/**
 * Builds a smooth raise -> N half-cycle sine oscillation -> smooth return keyframe track
 * (useful for waving, chopping, harvesting, cheering, tail wagging, and rowing).
 */
export const oscillateBoneTrack = (options: {
  readonly startAt: number
  readonly endAt: number
  readonly halfCycles: number
  readonly base?: Partial<BoneAngles>
  readonly amplitude: Partial<BoneAngles>
}): readonly BoneKeyframe[] => {
  const { startAt, endAt, halfCycles, base, amplitude } = options
  const basePitch = base?.pitch ?? 0
  const baseYaw = base?.yaw ?? 0
  const baseRoll = base?.roll ?? 0

  const keyframes: BoneKeyframe[] = [
    { at: 0, pitch: 0, yaw: 0, roll: 0 },
    { at: startAt, pitch: basePitch, yaw: baseYaw, roll: baseRoll, easing: KeyframeEasing.Smoothstep },
  ]

  for (let step = 1; step <= halfCycles; ++step) {
    const t = startAt + ((endAt - startAt) * step) / (halfCycles + 1)
    const sign = step % 2 === 1 ? 1 : -1
    keyframes.push({
      at: t,
      pitch: basePitch + sign * (amplitude.pitch ?? 0),
      yaw: baseYaw + sign * (amplitude.yaw ?? 0),
      roll: baseRoll + sign * (amplitude.roll ?? 0),
      easing: KeyframeEasing.SineInOut,
    })
  }

  keyframes.push(
    { at: endAt, pitch: basePitch, yaw: baseYaw, roll: baseRoll, easing: KeyframeEasing.SineInOut },
    { at: 1, pitch: 0, yaw: 0, roll: 0, easing: KeyframeEasing.Smoothstep },
  )
  return keyframes
}

export const sampleClipAtProgress = <BoneName extends string>(
  boneNames: readonly BoneName[],
  clip: AnimationClipSpec<BoneName>,
  progress: number,
): SampledClipPose<BoneName> => {
  const bones = {} as Record<BoneName, BoneAngles>
  for (const name of boneNames) {
    const keyframes = clip.tracks?.[name]
    bones[name] = keyframes
      ? {
          pitch: sampleScalarTrack(keyframes, progress, k => k.pitch ?? 0),
          yaw: sampleScalarTrack(keyframes, progress, k => k.yaw ?? 0),
          roll: sampleScalarTrack(keyframes, progress, k => k.roll ?? 0),
        }
      : { pitch: 0, yaw: 0, roll: 0 }
  }

  const rootKeyframes = clip.rootOffset
  const pose: SampledClipPose<BoneName> = {
    localRootOffset: rootKeyframes
      ? [
          sampleScalarTrack(rootKeyframes, progress, k => k.x ?? 0),
          sampleScalarTrack(rootKeyframes, progress, k => k.y ?? 0),
          sampleScalarTrack(rootKeyframes, progress, k => k.z ?? 0),
        ]
      : [0, 0, 0],
    verticalBlocksOffset: rootKeyframes
      ? sampleScalarTrack(rootKeyframes, progress, k => k.verticalBlocksOffset ?? 0)
      : 0,
    bones,
  }

  clip.evaluate?.(progress, pose)
  return pose
}

/**
 * Mirrors any clip (tracks, rootOffset, and/or evaluate) across the entity's sagittal XY plane (z -> -z),
 * swapping Left/Right bone pairs and negating yaw, roll, and lateral Z root offsets.
 */
export const mirrorClipLeftRight = <BoneName extends string>(
  clip: AnimationClipSpec<BoneName>,
  mirrorBones: MirrorBoneMap<BoneName>,
): AnimationClipSpec<BoneName> => {
  const pairs: [BoneName, BoneName][] = []
  const pairedBones = new Set<BoneName>()
  for (const [leftBone, rightRef] of Object.entries(mirrorBones) as [BoneName, BoneRef<BoneName> | undefined][]) {
    if (!rightRef) continue
    const rightBone = extractBoneRefKey(rightRef)
    pairs.push([leftBone, rightBone])
    pairedBones.add(leftBone)
    pairedBones.add(rightBone)
  }

  return {
    blendInTicks: clip.blendInTicks,
    stepMovement: clip.stepMovement,
    ambientWeight: clip.ambientWeight,
    evaluate(progress, out) {
      const boneNames = Object.keys(out.bones) as BoneName[]
      const source = sampleClipAtProgress(boneNames, clip, progress)
      out.localRootOffset = [source.localRootOffset[0], source.localRootOffset[1], -source.localRootOffset[2]]
      out.verticalBlocksOffset = source.verticalBlocksOffset

      for (const [leftBone, rightBone] of pairs) {
        const left = source.bones[leftBone]
        const right = source.bones[rightBone]
        out.bones[leftBone] = { pitch: right.pitch, yaw: -right.yaw, roll: -right.roll }
        out.bones[rightBone] = { pitch: left.pitch, yaw: -left.yaw, roll: -left.roll }
      }
      for (const bone of boneNames) {
        if (!pairedBones.has(bone)) {
          const angles = source.bones[bone]
          out.bones[bone] = { pitch: angles.pitch, yaw: -angles.yaw, roll: -angles.roll }
        }
      }
    },
  }
}

export type Quaternion = [number, number, number, number]

const multiplyQuaternions = (a: Quaternion, b: Quaternion): Quaternion => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]

/**
 * Composes q_Y(yaw) * q_Z(pitch) * q_X(roll) into a unit quaternion [x, y, z, w],
 * matching right-handed RotateY(yaw) * RotateZ(pitch) * RotateX(roll).
 */
export const eulerToQuaternion = ({ pitch, yaw, roll }: BoneAngles): Quaternion => {
  const qx: Quaternion = [Math.sin(roll * 0.5), 0, 0, Math.cos(roll * 0.5)]
  const qz: Quaternion = [0, 0, Math.sin(pitch * 0.5), Math.cos(pitch * 0.5)]
  const qy: Quaternion = [0, Math.sin(yaw * 0.5), 0, Math.cos(yaw * 0.5)]
  const combined = multiplyQuaternions(qy, multiplyQuaternions(qz, qx))
  const length = Math.hypot(combined[0], combined[1], combined[2], combined[3]) || 1
  return [combined[0] / length, combined[1] / length, combined[2] / length, combined[3] / length]
}
