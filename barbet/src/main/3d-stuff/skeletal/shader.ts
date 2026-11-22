import {
  GameTickUniform,
  PIConstantHeader,
  RotationVectorsDeclaration,
  TerrainHeightMultiplierUniform,
} from '@3d/common-shader'
import { AttrType, Spec, TextureFormat } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { TextureSlot } from '@3d/texture-slot-counter'
import { FACING_TURN_DURATION } from '@game/new-entities/stores/facing'
import { HEAD_CENTER_BYTE, HEAD_MAX_PITCH, HEAD_MAX_YAW, HEAD_TURN_DURATION } from '@game/new-entities/stores/head-look'
import { generateSkeletalRigGlsl } from './glsl-rig'
import { PoseAtlasAllocation } from './pose-atlas'
import { BoneRef, CompiledSkeleton, resolveBoneIndex } from './skeleton'

/** Internal prefix isolating entity `extraInstanceAttributes` from base mesh/instance attributes and varyings */
export const EXTRA_INSTANCE_ATTRIBUTE_PREFIX = 'extraAttr_'
const EXTRA_FORWARDED_VARYING_PREFIX = 'extraVarying_'

export interface ExtraInstanceAttributeSpec {
  readonly count: 1 | 2 | 3 | 4
  readonly type: AttrType
  readonly normalize?: boolean
  /** When true, automatically forwards this per-instance attribute to `resolveFragmentColor` via a `flat` varying */
  readonly passToFragment?: boolean
}

export interface SkeletalHeadLookConfig<BoneName extends string> {
  readonly headBone: BoneRef<BoneName>
  readonly maxYaw?: number
  readonly maxPitch?: number
  readonly turnDurationTicks?: number
}

export type SkeletalExtraAttributeVars<ExtraAttrs extends Record<string, ExtraInstanceAttributeSpec>> = Readonly<
  Record<Extract<keyof ExtraAttrs, string>, string>
>

export interface SkeletalShaderSpecOptions<
  BoneName extends string,
  ExtraAttrs extends Record<string, ExtraInstanceAttributeSpec> = {},
> {
  readonly skeleton: CompiledSkeleton<BoneName>
  readonly poseAtlasAllocation: PoseAtlasAllocation
  /** Optional smooth 2-axis head gaze wired to `HeadLookStore` */
  readonly headLook?: SkeletalHeadLookConfig<BoneName>
  /**
   * Optional entity-specific per-instance attributes. Keys are internally prefixed (`extraAttr_`)
   * so they cannot collide with base attributes/varyings, and are grouped by component size (4B -> 2B -> 1B)
   * so the interleaved instance stride stays tightly packed without alignment gaps.
   */
  readonly extraInstanceAttributes?: ExtraAttrs
  /** Entity-specific GLSL constants, palettes, and helper functions (`SkeletalContext` is already declared above) */
  readonly utilDeclarations?: string
  /**
   * Optional boolean GLSL expression collapsing hidden optional cuboids before morphs/FK.
   * GLSL scope: `SkeletalContext ctx`, `vec3 model`, `vec3 normal`.
   */
  readonly isVertexHidden?: (attrs: SkeletalExtraAttributeVars<ExtraAttrs>) => string
  /**
   * Optional GLSL statements mutating rest-pose `model`/`normal` before forward kinematics.
   * GLSL scope: `inout vec3 model`, `inout vec3 normal`, `SkeletalContext ctx`.
   */
  readonly preprocessVertex?: (attrs: SkeletalExtraAttributeVars<ExtraAttrs>) => string
  /**
   * Optional GLSL expression returning a modified `vec4` quaternion during forward kinematics.
   * GLSL scope: `int boneIndex`, `vec4 boneQuat`, `SkeletalContext ctx`.
   */
  readonly modifyBoneQuaternion?: (attrs: SkeletalExtraAttributeVars<ExtraAttrs>) => string
  /**
   * Optional GLSL statements mutating posed `model`/`normal` after FK and `rootMotion`.
   * GLSL scope: `inout vec3 model`, `inout vec3 normal`, `SkeletalContext ctx`.
   */
  readonly postprocessPosedModel?: (attrs: SkeletalExtraAttributeVars<ExtraAttrs>) => string
  /**
   * GLSL expression returning the unlit `vec3` base color for the current fragment.
   * GLSL scope: `uint paletteSlot`, `uint entityId` (plus forwarded `attrs` with `passToFragment: true`).
   */
  readonly resolveFragmentColor: (attrs: SkeletalExtraAttributeVars<ExtraAttrs>) => string
}

export interface SkeletalShader<BoneName extends string = string, ExtraAttrs extends Record<string, any> = {}> {
  readonly skeleton: CompiledSkeleton<BoneName>
  readonly hasHeadLook: boolean
  readonly extraInstanceAttributes: ExtraAttrs | undefined
  readonly spec: Required<Spec<'mesh' | 'instances', 'entity', never, 'poseAtlas'>>
}

export const paletteToGlsl = (palette: readonly number[]): string[] =>
  palette.map(hex => {
    const red = (((hex >> 16) & 0xff) / 255).toFixed(6)
    const green = (((hex >> 8) & 0xff) / 255).toFixed(6)
    const blue = (((hex >> 0) & 0xff) / 255).toFixed(6)
    return `vec3(${red}, ${green}, ${blue})`
  })

export const declareGlslPalette = (name: string, palette: readonly number[]): string => {
  const entries = paletteToGlsl(palette)
  return `const vec3 ${name}[${entries.length}] = vec3[${entries.length}](\n  ${entries.join(',\n  ')}\n);`
}

const getAttributeComponentBytes = (type: AttrType): 1 | 2 | 4 => {
  if (type === AttrType.UByte) return 1
  if (type === AttrType.UShort) return 2
  return 4
}

const getGlslAttributeType = (count: 1 | 2 | 3 | 4, type: AttrType, normalize?: boolean): string => {
  const isFloat = type === AttrType.Float || normalize === true
  if (count === 1) return isFloat ? 'float' : 'uint'
  return (isFloat ? 'vec' : 'uvec') + count
}

/**
 * Builds a WebGL2 shader `Spec` for a skeletal entity, handling static mesh attributes,
 * tightly packed per-instance attributes (`entityAndTicks`, `tilePosition`, `animationIds`,
 * `facingAndPreviousFrame`, optional `headPoses`, and `extraInstanceAttributes`),
 * ancestor-chain quaternion forward kinematics, root motion, 8-way facing interpolation,
 * world tile-step offset, diffuse lighting, and mouse-picking `entityId` output.
 */
export const createSkeletalShaderSpec = <
  BoneName extends string,
  ExtraAttrs extends Record<string, ExtraInstanceAttributeSpec> = {},
>(
  options: SkeletalShaderSpecOptions<BoneName, ExtraAttrs>,
): SkeletalShader<BoneName, ExtraAttrs> => {
  const { skeleton, poseAtlasAllocation, headLook, extraInstanceAttributes } = options
  const hasHeadLook = headLook !== undefined
  const headBoneIndex = headLook ? resolveBoneIndex(skeleton, headLook.headBone) : -1
  const headMaxYaw = headLook?.maxYaw ?? HEAD_MAX_YAW
  const headMaxPitch = headLook?.maxPitch ?? HEAD_MAX_PITCH
  const headTurnDuration = headLook?.turnDurationTicks ?? HEAD_TURN_DURATION

  // Bucket extra attributes by component byte size (4B -> 2B -> 1B) and namespace their internal Spec keys
  // so mixed-width attributes pack with zero alignment gaps and cannot collide with base shader variables.
  const extra4Byte: Record<string, any> = {}
  const extra2Byte: Record<string, any> = {}
  const extra1Byte: Record<string, any> = {}
  const extraKeys: string[] = []
  const forwardedKeys: string[] = []
  const forwardedVaryings: Record<string, { type: string; flat: true }> = {}

  for (const [key, attribute] of Object.entries(extraInstanceAttributes ?? {})) {
    extraKeys.push(key)
    const namespacedAttrKey = EXTRA_INSTANCE_ATTRIBUTE_PREFIX + key
    const boundAttribute = {
      count: attribute.count,
      type: attribute.type,
      ...(attribute.normalize !== undefined ? { normalize: attribute.normalize } : {}),
      divisor: 1,
      bindTo: { instances: true },
    }

    const componentBytes = getAttributeComponentBytes(attribute.type)
    if (componentBytes === 4) extra4Byte[namespacedAttrKey] = boundAttribute
    else if (componentBytes === 2) extra2Byte[namespacedAttrKey] = boundAttribute
    else extra1Byte[namespacedAttrKey] = boundAttribute

    if (attribute.passToFragment) {
      forwardedKeys.push(key)
      forwardedVaryings[EXTRA_FORWARDED_VARYING_PREFIX + key] = {
        type: getGlslAttributeType(attribute.count, attribute.type, attribute.normalize),
        flat: true,
      }
    }
  }

  const headLookUtilGlsl = hasHeadLook
    ? `
vec2 decodeHeadPose(uint packedPose) {
  float yawByte = float(packedPose & 0xFFU);
  float pitchByte = float((packedPose >> 8U) & 0xFFU);
  float yaw = ((yawByte - ${HEAD_CENTER_BYTE.toFixed(1)}) / 127.0) * ${headMaxYaw.toFixed(6)};
  float pitch = ((pitchByte - ${HEAD_CENTER_BYTE.toFixed(1)}) / 127.0) * ${headMaxPitch.toFixed(6)};
  return vec2(yaw, pitch);
}
`
    : ''

  const utilDeclarations = () => `
${PIConstantHeader()}
${RotationVectorsDeclaration()}
${generateSkeletalRigGlsl(skeleton, poseAtlasAllocation)}

struct SkeletalContext {
  uint boneId;
  uint paletteSlot;
  uint entityId;
  uint phaseSeed;
  float ambientWeight;
  vec2 currentHeadAngles;
  vec2 targetHeadAngles;
};

mat3 rotateAroundY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

vec4 quaternionFromYawPitch(float yaw, float pitch) {
  vec4 qy = vec4(0.0, sin(yaw * 0.5), 0.0, cos(yaw * 0.5));
  vec4 qz = vec4(0.0, 0.0, sin(pitch * 0.5), cos(pitch * 0.5));
  return multiplyQuaternions(qy, qz);
}

vec4 quaternionFromPitchRoll(float pitch, float roll) {
  vec4 qz = vec4(0.0, 0.0, sin(pitch * 0.5), cos(pitch * 0.5));
  vec4 qx = vec4(sin(roll * 0.5), 0.0, 0.0, cos(roll * 0.5));
  return multiplyQuaternions(qz, qx);
}

float smoothPulse(float riseStart, float riseEnd, float fallStart, float fallEnd, float value) {
  return smoothstep(riseStart, riseEnd, value) * (1.0 - smoothstep(fallStart, fallEnd, value));
}

float hashUintToSignedUnit(uint value) {
  value = (value ^ 61U) ^ (value >> 16U);
  value *= 9U;
  value = value ^ (value >> 4U);
  value *= 0x27d4eb2dU;
  value = value ^ (value >> 15U);
  return float(value & 0xFFFFU) / 32767.5 - 1.0;
}

float computeFacingAngle(uint packedFacing, float facingElapsedTicks) {
  int currentDirection = int(packedFacing & 7U);
  int previousDirection = int((packedFacing >> 3U) & 7U);

  int deltaSteps = currentDirection - previousDirection;
  if (deltaSteps > 4) {
    deltaSteps -= 8;
  } else if (deltaSteps < -4) {
    deltaSteps += 8;
  }

  float progress = smoothstep(0.0, ${FACING_TURN_DURATION.toFixed(1)}, facingElapsedTicks);
  float interpolatedDirection = float(previousDirection) + float(deltaSteps) * progress;
  return interpolatedDirection * (PI * 0.25);
}
${headLookUtilGlsl}
${options.utilDeclarations ?? ''}
`

  const vertexMain = (a: Record<string, string>) => {
    const rawVertexAttrs: Record<string, string> = {}
    for (const key of extraKeys) {
      rawVertexAttrs[key] = a[EXTRA_INSTANCE_ATTRIBUTE_PREFIX + key]!
    }
    const vertexAttrs = rawVertexAttrs as SkeletalExtraAttributeVars<ExtraAttrs>

    const headLookVertexGlsl = hasHeadLook
      ? `
float headLookElapsedTicks = max(0.0, ${GameTickUniform} - float(${a.entityAndTicks}.w));
vec2 previousHeadAngles = decodeHeadPose(${a.headPoses}.x);
vec2 targetHeadAngles = decodeHeadPose(${a.headPoses}.y);
vec2 currentHeadAngles = mix(
  previousHeadAngles,
  targetHeadAngles,
  smoothstep(0.0, ${headTurnDuration.toFixed(1)}, headLookElapsedTicks)
);`
      : `
vec2 currentHeadAngles = vec2(0.0);
vec2 targetHeadAngles = vec2(0.0);`

    const headLookBoneRotationGlsl = hasHeadLook
      ? `
    if (boneIndex == ${headBoneIndex}) {
      boneQuat = multiplyQuaternions(quaternionFromYawPitch(ctx.currentHeadAngles.x, ctx.currentHeadAngles.y), boneQuat);
    }`
      : ''

    const modifyBoneQuatGlsl = options.modifyBoneQuaternion
      ? `
    boneQuat = ${options.modifyBoneQuaternion(vertexAttrs)};`
      : ''

    const poseBodyGlsl = `
  ${options.preprocessVertex ? options.preprocessVertex(vertexAttrs) : ''}
  int boneIndex = int(ctx.boneId);
  for (int step = 0; step < RIG_MAX_CHAIN_DEPTH; ++step) {
    if (boneIndex < 0) break;
    vec4 boneQuat = sampleBlendedBoneQuaternion(
      ${a.poseAtlas},
      animationId,
      timing.frame,
      previousAnimationId,
      previousAnimationFrame,
      timing.blend,
      boneIndex
    );${headLookBoneRotationGlsl}${modifyBoneQuatGlsl}
    rotateAroundPivotByQuaternion(model, normal, boneQuat, RIG_BONE_PIVOTS[boneIndex]);
    boneIndex = RIG_BONE_PARENTS[boneIndex];
  }

  vec4 rootMotion = sampleBlendedRootMotion(
    ${a.poseAtlas},
    animationId,
    timing.frame,
    previousAnimationId,
    previousAnimationFrame,
    timing.blend
  );
  model += rootMotion.xyz;
  verticalBlocksOffset = rootMotion.w;
  ${options.postprocessPosedModel ? options.postprocessPosedModel(vertexAttrs) : ''}`

    // NOTE: Optional cuboids (e.g. Steve's beard, bangs, or sleeve cuffs) live inside the shared static mesh so all
    // instances draw in a single instanced call instead of splitting meshes per outfit permutation. Collapsing hidden
    // cuboids to `model = vec3(0.0)` turns their faces into zero-area degenerate triangles that the GPU discards in
    // hardware triangle setup while skipping FK pose-atlas texture fetches on the hidden branch.
    const guardedPoseGlsl = options.isVertexHidden
      ? `if (${options.isVertexHidden(vertexAttrs)}) {
  model = vec3(0.0);
} else {${poseBodyGlsl}
}`
      : `{${poseBodyGlsl}
}`

    const forwardedAssignmentsGlsl = forwardedKeys
      .map(key => `${a[EXTRA_FORWARDED_VARYING_PREFIX + key]} = ${a[EXTRA_INSTANCE_ATTRIBUTE_PREFIX + key]};`)
      .join('\n')

    return `
vec3 model = ${a.position};
vec3 normal = ${a.normal};

uint entityId = ${a.entityAndTicks}.x;
float animationElapsedTicks = max(0.0, ${GameTickUniform} - float(${a.entityAndTicks}.y));
float facingElapsedTicks = max(0.0, ${GameTickUniform} - float(${a.entityAndTicks}.z));${headLookVertexGlsl}

uint animationId = ${a.animationIds}.x;
uint previousAnimationId = ${a.animationIds}.y;
uint facing = ${a.facingAndPreviousFrame}.x;
uint previousAnimationFrame = ${a.facingAndPreviousFrame}.y;
uint phaseSeed = (entityId & 0xFFFFU) ^ (((entityId >> 16U) & 0x7FU) * 37U);

EvaluatedClipTiming timing = evaluateClipTiming(animationId, previousAnimationFrame, animationElapsedTicks);
SkeletalContext ctx = SkeletalContext(
  ${a.boneAndPalette}.x,
  ${a.boneAndPalette}.y,
  entityId,
  phaseSeed,
  timing.ambientWeight,
  currentHeadAngles,
  targetHeadAngles
);

float verticalBlocksOffset = 0.0;
${guardedPoseGlsl}

mat3 facingRotation = rotateAroundY(computeFacingAngle(facing, facingElapsedTicks));
model = facingRotation * model;
normal = facingRotation * normal;

vec3 worldStepOffset = timing.hasStepMovement
  ? rotationVectors[facing & 7U] * (timing.progress - 1.0)
  : vec3(0.0);
worldStepOffset.y = verticalBlocksOffset * ${TerrainHeightMultiplierUniform};

vec3 worldPosition = model + vec3(
  float(${a.tilePosition}.x) + 0.5,
  float(${a.tilePosition}.y) * ${TerrainHeightMultiplierUniform},
  float(${a.tilePosition}.z) + 0.5
) + worldStepOffset;

${a.worldNormal} = normal;
${a.vertexPaletteSlot} = ctx.paletteSlot;
${a.pickedEntityId} = ctx.entityId;
${forwardedAssignmentsGlsl}
`
  }

  const fragmentMain = (a: Record<string, string>) => {
    const rawFragmentAttrs: Record<string, string> = {}
    for (const key of forwardedKeys) {
      rawFragmentAttrs[key] = a[EXTRA_FORWARDED_VARYING_PREFIX + key]!
    }
    const fragmentAttrs = rawFragmentAttrs as SkeletalExtraAttributeVars<ExtraAttrs>

    return `
uint paletteSlot = ${a.vertexPaletteSlot};
uint entityId = ${a.pickedEntityId};
vec3 baseColor = clamp(${options.resolveFragmentColor(fragmentAttrs)}, 0.0, 1.0);

float light = clamp(dot(normalize(${a.worldNormal}), u_light.xyz), u_light.w, 1.0);
vec3 litColor = mix(baseColor, baseColor * light, 0.8);
uint v_entityId = entityId;
`
  }

  const spec = {
    buffers: {
      mesh: {
        dynamic: false,
      },
      instances: {
        dynamic: true,
      },
    },
    textures: {
      poseAtlas: {
        textureSlot: TextureSlot.SkeletalPoseAtlas,
        format: TextureFormat.RGBA16F,
        external: true,
      },
    },
    programs: {
      entity: {
        utilDeclarations,
        vertexMain,
        vertexFinalPosition: 'worldPosition',
        fragmentMain,
        fragmentFinalColor: 'vec4(litColor, 1.0)',
        fragmentEntityId: 'v_entityId',
        textureSamplers: {
          poseAtlas: {},
        },
        varyings: {
          worldNormal: { type: 'vec3' },
          vertexPaletteSlot: { type: 'uint', flat: true },
          pickedEntityId: { type: 'uint', flat: true },
          ...forwardedVaryings,
        },
        attributes: {
          // Per-vertex static cuboid mesh attributes (3 slots, 28-byte stride)
          position: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
          normal: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
          boneAndPalette: { count: 2, type: AttrType.UShort, bindTo: { mesh: true } },

          // Per-instance dynamic attributes ordered 4B -> 2B -> 1B across base + extra fields
          // so mixed-width attributes pack tightly with zero alignment gaps and minimal attribute slots.
          entityAndTicks: {
            count: hasHeadLook ? 4 : 3,
            type: AttrType.UInt,
            divisor: 1,
            bindTo: { instances: true },
          },
          ...extra4Byte,
          tilePosition: { count: 3, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
          animationIds: { count: 2, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
          ...(hasHeadLook
            ? { headPoses: { count: 2, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } } }
            : {}),
          ...extra2Byte,
          facingAndPreviousFrame: { count: 2, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
          ...extra1Byte,
        },
      },
    },
  } as const satisfies Spec<any, any, any, any>

  return {
    skeleton,
    hasHeadLook,
    extraInstanceAttributes,
    spec,
  }
}
