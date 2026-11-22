import { AnimationClipSpec, eulerToQuaternion, Quaternion, sampleClipAtProgress } from './clip'
import { CompiledSkeleton } from './skeleton'

export const POSE_ATLAS_FRAMES = 64

export const enum ClipMetadataFlag {
  Loop = 1 << 0,
  StepMovement = 1 << 1,
}

export interface ClipTimingMetadata {
  readonly durationTicks: number
  readonly loop: boolean
}

export interface RegisteredClipEntry<BoneName extends string> {
  readonly clip: AnimationClipSpec<BoneName>
  readonly timing: ClipTimingMetadata
}

export interface PoseAtlasAllocation {
  readonly baseRow: number
  readonly rowsPerClip: number
  readonly clipCount: number
  readonly clipMetaGlslEntries: readonly string[]
}

export interface BuiltSkeletalPoseAtlas {
  readonly width: number
  readonly height: number
  readonly texels: Float32Array
}

const nextPowerOfTwo = (value: number): number => {
  let power = 1
  while (power < value) power <<= 1
  return power
}

export const createSkeletalPoseAtlasBuilder = () => {
  const rowDataChunks: Float32Array[] = []
  let totalRows = 0

  return {
    registerClipSet<BoneName extends string>(
      skeleton: CompiledSkeleton<BoneName>,
      entries: readonly RegisteredClipEntry<BoneName>[],
    ): PoseAtlasAllocation {
      const boneCount = skeleton.boneNames.length
      // Row 0 = vec4(localRootOffset.xyz, verticalBlocksOffset); Rows 1..boneCount = unit quaternion per bone
      const rowsPerClip = 1 + boneCount
      const baseRow = totalRows
      const clipRows = entries.length * rowsPerClip
      const chunk = new Float32Array(clipRows * POSE_ATLAS_FRAMES * 4)
      const clipMetaGlslEntries: string[] = []

      for (let clipIndex = 0; clipIndex < entries.length; ++clipIndex) {
        const { clip, timing } = entries[clipIndex]!
        const blendInTicks = clip.blendInTicks ?? 5
        const ambientWeight = clip.ambientWeight ?? 1
        const flags =
          (timing.loop ? ClipMetadataFlag.Loop : 0) | (clip.stepMovement ? ClipMetadataFlag.StepMovement : 0)

        const invDuration = (1 / Math.max(1, timing.durationTicks)).toFixed(6)
        const invBlendIn = blendInTicks > 0 ? (1 / blendInTicks).toFixed(6) : '1000000.0'
        clipMetaGlslEntries.push(`vec4(${invDuration}, ${invBlendIn}, ${flags}.0, ${ambientWeight.toFixed(4)})`)

        const previousBoneQuaternions: (Quaternion | null)[] = new Array(boneCount).fill(null)

        for (let frame = 0; frame < POSE_ATLAS_FRAMES; ++frame) {
          const progress = frame / (POSE_ATLAS_FRAMES - 1)
          const sampled = sampleClipAtProgress(skeleton.boneNames, clip, progress)

          const rootRow = clipIndex * rowsPerClip
          const rootTexelBase = (rootRow * POSE_ATLAS_FRAMES + frame) * 4
          chunk[rootTexelBase + 0] = sampled.localRootOffset[0]
          chunk[rootTexelBase + 1] = sampled.localRootOffset[1]
          chunk[rootTexelBase + 2] = sampled.localRootOffset[2]
          chunk[rootTexelBase + 3] = sampled.verticalBlocksOffset

          for (let boneIndex = 0; boneIndex < boneCount; ++boneIndex) {
            const boneName = skeleton.boneNames[boneIndex]!
            const quaternion = eulerToQuaternion(sampled.bones[boneName])

            // Keep consecutive frames in the same quaternion hemisphere so hardware GL_LINEAR filtering never flips
            const prev = previousBoneQuaternions[boneIndex]
            if (prev) {
              const dot =
                prev[0] * quaternion[0] + prev[1] * quaternion[1] + prev[2] * quaternion[2] + prev[3] * quaternion[3]
              if (dot < 0) {
                quaternion[0] = -quaternion[0]
                quaternion[1] = -quaternion[1]
                quaternion[2] = -quaternion[2]
                quaternion[3] = -quaternion[3]
              }
            }
            previousBoneQuaternions[boneIndex] = quaternion

            const boneRow = clipIndex * rowsPerClip + 1 + boneIndex
            const boneTexelBase = (boneRow * POSE_ATLAS_FRAMES + frame) * 4
            chunk[boneTexelBase + 0] = quaternion[0]
            chunk[boneTexelBase + 1] = quaternion[1]
            chunk[boneTexelBase + 2] = quaternion[2]
            chunk[boneTexelBase + 3] = quaternion[3]
          }
        }
      }

      rowDataChunks.push(chunk)
      totalRows += clipRows

      return {
        baseRow,
        rowsPerClip,
        clipCount: entries.length,
        clipMetaGlslEntries,
      }
    },

    build(): BuiltSkeletalPoseAtlas {
      const height = nextPowerOfTwo(Math.max(1, totalRows))
      const texels = new Float32Array(POSE_ATLAS_FRAMES * height * 4)

      let floatOffset = 0
      for (const chunk of rowDataChunks) {
        texels.set(chunk, floatOffset)
        floatOffset += chunk.length
      }

      return {
        width: POSE_ATLAS_FRAMES,
        height,
        texels,
      }
    },
  }
}

const sharedAtlasBuilder = createSkeletalPoseAtlasBuilder()
let cachedSharedAtlas: BuiltSkeletalPoseAtlas | null = null

export const registerClipRecord = <BoneName extends string, ClipId extends number, Size extends ClipId>(
  skeleton: CompiledSkeleton<BoneName>,
  clipCount: Size,
  clipsById: Record<Exclude<ClipId, Size>, AnimationClipSpec<BoneName>>,
  getDurationTicks: (id: ClipId) => number,
  isLooping: (id: ClipId) => boolean,
): PoseAtlasAllocation => {
  if (cachedSharedAtlas !== null) {
    throw new Error('Cannot register entity clip sets after the shared SkeletalPoseAtlas has been built.')
  }

  const entries: RegisteredClipEntry<BoneName>[] = []
  for (let id = 0; id < clipCount; ++id) {
    const clipId = id as Exclude<ClipId, Size>
    entries.push({
      clip: clipsById[clipId],
      timing: {
        durationTicks: getDurationTicks(clipId),
        loop: isLooping(clipId),
      },
    })
  }
  return sharedAtlasBuilder.registerClipSet(skeleton, entries)
}

export const getSharedSkeletalPoseAtlas = (): BuiltSkeletalPoseAtlas => {
  if (cachedSharedAtlas === null) {
    cachedSharedAtlas = sharedAtlasBuilder.build()
  }
  return cachedSharedAtlas
}
