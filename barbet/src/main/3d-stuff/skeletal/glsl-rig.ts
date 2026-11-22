import { ClipMetadataFlag, POSE_ATLAS_FRAMES, PoseAtlasAllocation } from './pose-atlas'
import { CompiledSkeleton } from './skeleton'

export const NO_CROSSFADE_FRAME = 255

/**
 * Generates zero-branch skeletal sampling and forward-kinematics GLSL helpers for a compiled skeleton
 * and its allocation inside the shared RGBA16F SkeletalPoseAtlas.
 */
export const generateSkeletalRigGlsl = <BoneName extends string>(
  skeleton: CompiledSkeleton<BoneName>,
  allocation: PoseAtlasAllocation,
): string => {
  const pivotsGlsl = skeleton.pivots
    .map(([x, y, z]) => `vec3(${x.toFixed(6)}, ${y.toFixed(6)}, ${z.toFixed(6)})`)
    .join(',\n  ')
  const parentsGlsl = skeleton.parentIndices.join(', ')
  const boneCount = skeleton.boneNames.length
  const maxClipIndex = Math.max(0, allocation.clipCount - 1)

  // NOTE: Step-movement clips (`Walk`, `WalkUp`, `WalkDown`) are non-looping (`loop: false`), and `evaluateClipTiming`
  // also guards `!hasStepMovement` so `progress` always clamps to [0, 1] on extrapolated/fake frames (`rawProgress >= 1.0`).
  // Because PositionStore advances only when update-worker commits the next tick, clamping keeps `worldStepOffset` at 0.0
  // at the destination tile instead of wrapping back to -1.0 for a frame.
  return `
const int RIG_BONE_COUNT = ${boneCount};
const int RIG_MAX_CHAIN_DEPTH = ${skeleton.maxChainDepth};
const int RIG_ATLAS_BASE_ROW = ${allocation.baseRow};
const int RIG_ATLAS_ROWS_PER_CLIP = ${allocation.rowsPerClip};
const float INV_ATLAS_WIDTH = ${(1 / POSE_ATLAS_FRAMES).toFixed(8)};

const vec3 RIG_BONE_PIVOTS[${boneCount}] = vec3[${boneCount}](
  ${pivotsGlsl}
);

const int RIG_BONE_PARENTS[${boneCount}] = int[${boneCount}](${parentsGlsl});

const vec4 RIG_CLIP_META[${allocation.clipCount}] = vec4[${allocation.clipCount}](
  ${allocation.clipMetaGlslEntries.join(',\n  ')}
);

struct EvaluatedClipTiming {
  float progress;
  float frame;
  float blend;
  float ambientWeight;
  bool hasStepMovement;
};

vec3 rotateVectorByQuaternion(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

void rotateAroundPivotByQuaternion(inout vec3 position, inout vec3 normal, vec4 q, vec3 pivot) {
  position = pivot + rotateVectorByQuaternion(q, position - pivot);
  normal = rotateVectorByQuaternion(q, normal);
}

vec4 multiplyQuaternions(vec4 a, vec4 b) {
  return vec4(
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  );
}

vec4 nlerpQuaternions(vec4 fromQuat, vec4 toQuat, float t) {
  vec4 alignedTo = dot(fromQuat, toQuat) < 0.0 ? -toQuat : toQuat;
  return normalize(mix(fromQuat, alignedTo, t));
}

EvaluatedClipTiming evaluateClipTiming(uint clipId, uint previousFrame, float elapsedTicks) {
  uint safeClipId = min(clipId, ${maxClipIndex}U);
  vec4 meta = RIG_CLIP_META[safeClipId];
  uint flags = uint(meta.z + 0.5);
  bool isLoop = (flags & ${ClipMetadataFlag.Loop}U) != 0U;
  bool hasStepMovement = (flags & ${ClipMetadataFlag.StepMovement}U) != 0U;

  float rawProgress = elapsedTicks * meta.x;
  float progress = (isLoop && !hasStepMovement) ? fract(rawProgress) : clamp(rawProgress, 0.0, 1.0);
  float blend = (previousFrame == ${NO_CROSSFADE_FRAME}U)
    ? 1.0
    : clamp(elapsedTicks * meta.y, 0.0, 1.0);

  return EvaluatedClipTiming(
    progress,
    progress * ${(POSE_ATLAS_FRAMES - 1).toFixed(1)},
    blend,
    meta.w,
    hasStepMovement
  );
}

vec4 fetchPoseAtlasRow(sampler2D poseAtlas, uint clipId, int rowWithinClip, float frame) {
  int safeClip = int(min(clipId, ${maxClipIndex}U));
  int atlasRow = RIG_ATLAS_BASE_ROW + safeClip * RIG_ATLAS_ROWS_PER_CLIP + rowWithinClip;
  float invAtlasHeight = 1.0 / float(textureSize(poseAtlas, 0).y);
  vec2 uv = vec2((frame + 0.5) * INV_ATLAS_WIDTH, (float(atlasRow) + 0.5) * invAtlasHeight);
  return textureLod(poseAtlas, uv, 0.0);
}

vec4 sampleBlendedRootMotion(
  sampler2D poseAtlas,
  uint clipId,
  float frame,
  uint previousClipId,
  uint previousFrame,
  float blend
) {
  vec4 currentRoot = fetchPoseAtlasRow(poseAtlas, clipId, 0, frame);
  if (blend < 1.0) {
    vec4 previousRoot = fetchPoseAtlasRow(poseAtlas, previousClipId, 0, float(previousFrame));
    currentRoot.xyz = mix(previousRoot.xyz, currentRoot.xyz, blend);
  }
  return currentRoot;
}

vec4 sampleBlendedBoneQuaternion(
  sampler2D poseAtlas,
  uint clipId,
  float frame,
  uint previousClipId,
  uint previousFrame,
  float blend,
  int boneIndex
) {
  vec4 currentQuat = normalize(fetchPoseAtlasRow(poseAtlas, clipId, 1 + boneIndex, frame));
  if (blend < 1.0) {
    vec4 previousQuat = normalize(fetchPoseAtlasRow(poseAtlas, previousClipId, 1 + boneIndex, float(previousFrame)));
    return nlerpQuaternions(previousQuat, currentQuat, blend);
  }
  return currentQuat;
}
`
}
