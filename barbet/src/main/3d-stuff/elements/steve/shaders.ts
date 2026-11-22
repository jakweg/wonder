import {
  GameTickUniform,
  PIConstantHeader,
  RotationVectorsDeclaration,
  TerrainHeightMultiplierUniform,
} from '@3d/common-shader'
import { AttrType, createFromSpec, Spec, TextureFormat } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { generateSkeletalRigGlsl } from '@3d/skeletal/glsl-rig'
import { TextureSlot } from '@3d/texture-slot-counter'
import { FACING_TURN_DURATION } from '@game/new-entities/stores/facing'
import {
  STEVE_HEAD_CENTER_BYTE,
  STEVE_HEAD_MAX_PITCH,
  STEVE_HEAD_MAX_YAW,
  STEVE_HEAD_TURN_DURATION,
} from '@game/new-entities/stores/steve-animation'
import {
  STEVE_EYE_PALETTE,
  STEVE_HAIR_PALETTE,
  STEVE_HEIGHT_SCALE_STEP,
  STEVE_MIN_HEIGHT_SCALE,
  STEVE_MIN_WIDTH_SCALE,
  STEVE_PANTS_PALETTE,
  STEVE_SHIRT_PALETTE,
  STEVE_SHOE_PALETTE,
  STEVE_SKIN_PALETTE,
  STEVE_WIDTH_SCALE_STEP,
  SteveAppearanceShift,
  SteveHairStyle,
  SteveShirtTrimStyle,
} from '@game/new-entities/stores/steve-metadata'
import { stevePoseAtlasAllocation } from './animations'
import {
  STEVE_ARM_OFFSET_Z,
  STEVE_EYE_BOTTOM_Y,
  STEVE_HAIR_BACK_MID_Y,
  STEVE_HAIR_CROWN_MID_Y,
  STEVE_HAIR_SIDE_MID_Y,
  STEVE_HEAD_FRONT_RETRACT_X,
  STEVE_PIXEL_SCALE,
  StevePaletteSlot,
  steveSkeleton,
} from './mesh'

const HEAD_BONE = steveSkeleton.boneIndexByName.Head
const LEFT_UPPER_ARM_BONE = steveSkeleton.boneIndexByName.LeftUpperArm
const LEFT_FOREARM_BONE = steveSkeleton.boneIndexByName.LeftForearm
const RIGHT_UPPER_ARM_BONE = steveSkeleton.boneIndexByName.RightUpperArm
const RIGHT_FOREARM_BONE = steveSkeleton.boneIndexByName.RightForearm

const paletteToGlsl = (palette: readonly number[]) =>
  palette.map(hex => {
    const red = (((hex >> 16) & 0xff) / 255).toFixed(6)
    const green = (((hex >> 8) & 0xff) / 255).toFixed(6)
    const blue = (((hex >> 0) & 0xff) / 255).toFixed(6)
    return `vec3(${red}, ${green}, ${blue})`
  })

const shirtPaletteGlsl = /* @__PURE__ */ paletteToGlsl(STEVE_SHIRT_PALETTE)
const pantsPaletteGlsl = /* @__PURE__ */ paletteToGlsl(STEVE_PANTS_PALETTE)
const hairPaletteGlsl = /* @__PURE__ */ paletteToGlsl(STEVE_HAIR_PALETTE)
const skinPaletteGlsl = /* @__PURE__ */ paletteToGlsl(STEVE_SKIN_PALETTE)
const eyePaletteGlsl = /* @__PURE__ */ paletteToGlsl(STEVE_EYE_PALETTE)
const shoePaletteGlsl = /* @__PURE__ */ paletteToGlsl(STEVE_SHOE_PALETTE)

const utilDeclarations = () => `
${PIConstantHeader()}
${RotationVectorsDeclaration()}
${generateSkeletalRigGlsl(steveSkeleton, stevePoseAtlasAllocation)}

const vec3 shirtPalette[${shirtPaletteGlsl.length}] = vec3[${shirtPaletteGlsl.length}](
  ${shirtPaletteGlsl.join(',\n  ')}
);

const vec3 pantsPalette[${pantsPaletteGlsl.length}] = vec3[${pantsPaletteGlsl.length}](
  ${pantsPaletteGlsl.join(',\n  ')}
);

const vec3 hairPalette[${hairPaletteGlsl.length}] = vec3[${hairPaletteGlsl.length}](
  ${hairPaletteGlsl.join(',\n  ')}
);

const vec3 skinPalette[${skinPaletteGlsl.length}] = vec3[${skinPaletteGlsl.length}](
  ${skinPaletteGlsl.join(',\n  ')}
);

const vec3 eyePalette[${eyePaletteGlsl.length}] = vec3[${eyePaletteGlsl.length}](
  ${eyePaletteGlsl.join(',\n  ')}
);

const vec3 shoePalette[${shoePaletteGlsl.length}] = vec3[${shoePaletteGlsl.length}](
  ${shoePaletteGlsl.join(',\n  ')}
);

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

// Packed SteveAppearance bitfield extractors (layout defined in steve-metadata.ts)
uint getShirtColorId(uint appearance) { return (appearance >> ${SteveAppearanceShift.ShirtColor}U) & 15U; }
uint getPantsColorId(uint appearance) { return (appearance >> ${SteveAppearanceShift.PantsColor}U) & 7U; }
uint getHairColorId(uint appearance) { return (appearance >> ${SteveAppearanceShift.HairColor}U) & 7U; }
uint getSkinToneId(uint appearance) { return (appearance >> ${SteveAppearanceShift.SkinTone}U) & 3U; }
uint getEyeColorId(uint appearance) { return (appearance >> ${SteveAppearanceShift.EyeColor}U) & 3U; }
uint getShoeColorId(uint appearance) { return (appearance >> ${SteveAppearanceShift.ShoeColor}U) & 3U; }
uint getHairStyle(uint appearance) { return (appearance >> ${SteveAppearanceShift.HairStyle}U) & 3U; }
uint getShirtTrimStyle(uint appearance) { return (appearance >> ${SteveAppearanceShift.ShirtTrimStyle}U) & 3U; }
bool hasBeard(uint appearance) { return ((appearance >> ${SteveAppearanceShift.HasBeard}U) & 1U) != 0U; }
bool hasLongSleeves(uint appearance) { return ((appearance >> ${SteveAppearanceShift.HasLongSleeves}U) & 1U) != 0U; }
uint getHeightStep(uint appearance) { return (appearance >> ${SteveAppearanceShift.HeightStep}U) & 7U; }
uint getWidthStep(uint appearance) { return (appearance >> ${SteveAppearanceShift.WidthStep}U) & 3U; }

bool isArmBone(uint boneId) {
  return boneId >= ${LEFT_UPPER_ARM_BONE}U && boneId <= ${RIGHT_FOREARM_BONE}U;
}

bool isLeftArmBone(uint boneId) {
  return boneId == ${LEFT_UPPER_ARM_BONE}U || boneId == ${LEFT_FOREARM_BONE}U;
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

vec2 decodeHeadPose(uint packedPose) {
  float yawByte = float(packedPose & 0xFFU);
  float pitchByte = float((packedPose >> 8U) & 0xFFU);
  float yaw = ((yawByte - ${STEVE_HEAD_CENTER_BYTE.toFixed(1)}) / 127.0) * ${STEVE_HEAD_MAX_YAW.toFixed(6)};
  float pitch = ((pitchByte - ${STEVE_HEAD_CENTER_BYTE.toFixed(1)}) / 127.0) * ${STEVE_HEAD_MAX_PITCH.toFixed(6)};
  return vec2(yaw, pitch);
}

float hashUintToSignedUnit(uint value) {
  value = (value ^ 61U) ^ (value >> 16U);
  value *= 9U;
  value = value ^ (value >> 4U);
  value *= 0x27d4eb2dU;
  value = value ^ (value >> 15U);
  return float(value & 0xFFFFU) / 32767.5 - 1.0;
}

vec2 sampleEyeSaccadePixels(uint phaseSeed, uint stepIndex) {
  uint key = phaseSeed ^ (stepIndex * 1664525U + 1013904223U);
  if (hashUintToSignedUnit(key) > 0.25) {
    return vec2(0.0);
  }
  return vec2(
    hashUintToSignedUnit(key ^ 0x517cc1b7U) * 0.44,
    hashUintToSignedUnit(key ^ 0x2f6e2b1U) * 0.09
  );
}

// Procedural micro-layer: eye saccades, gaze lead, and asynchronous blinking
vec2 computeEyeOffset(uint phaseSeed, float ambientWeight, vec2 currentAngles, vec2 targetAngles) {
  float eyeStepTime = max(0.0, (${GameTickUniform} + float(phaseSeed & 31U)) / 36.0);
  uint stepIndex = uint(floor(eyeStepTime));
  float dartBlend = smoothstep(0.86, 1.0, fract(eyeStepTime));

  vec2 saccadePixels = mix(
    sampleEyeSaccadePixels(phaseSeed, stepIndex),
    sampleEyeSaccadePixels(phaseSeed, stepIndex + 1U),
    dartBlend
  ) * ambientWeight;

  vec2 angleDelta = targetAngles - currentAngles;
  float leadYaw = angleDelta.x * 1.4 + currentAngles.x * 0.45;
  float leadPitch = angleDelta.y * 0.5 + currentAngles.y * 0.35;

  float offsetZ = clamp(-leadYaw * 0.65 + saccadePixels.x, -0.46, 0.46) * ${STEVE_PIXEL_SCALE.toFixed(6)};
  float offsetY = clamp(leadPitch * 0.25 + saccadePixels.y, -0.1, 0.1) * ${STEVE_PIXEL_SCALE.toFixed(6)};
  return vec2(offsetZ, offsetY);
}

float computeEyeBlink(uint phaseSeed) {
  float periodTicks = 75.0 + float(phaseSeed & 63U) * 0.85;
  float cycleTick = mod(${GameTickUniform} + float((phaseSeed >> 4U) & 63U) * 1.7, periodTicks);
  return smoothPulse(0.0, 1.4, 1.4, 3.8, cycleTick);
}

void applyFaceMicroAnimation(
  inout vec3 model,
  uint paletteSlot,
  uint phaseSeed,
  float ambientWeight,
  vec2 currentHeadAngles,
  vec2 targetHeadAngles
) {
  if (paletteSlot == ${StevePaletteSlot.EyePupil}U) {
    vec2 eyeOffset = computeEyeOffset(phaseSeed, ambientWeight, currentHeadAngles, targetHeadAngles);
    model.z += eyeOffset.x;
    model.y += eyeOffset.y;
  }

  if (paletteSlot == ${StevePaletteSlot.EyeWhite}U || paletteSlot == ${StevePaletteSlot.EyePupil}U) {
    float blink = computeEyeBlink(phaseSeed);
    if (blink > 0.0) {
      model.y = mix(model.y, ${STEVE_EYE_BOTTOM_Y.toFixed(6)}, blink);
      model.x = mix(model.x, ${STEVE_HEAD_FRONT_RETRACT_X.toFixed(6)}, smoothstep(0.6, 1.0, blink));
    }
  }
}

vec4 applyProceduralBoneModifiers(
  int boneIndex,
  vec4 clipBoneQuat,
  vec2 headLookAngles,
  uint phaseSeed,
  float ambientWeight
) {
  if (boneIndex == ${HEAD_BONE}) {
    vec4 headLookQuat = quaternionFromYawPitch(headLookAngles.x, headLookAngles.y);
    return multiplyQuaternions(headLookQuat, clipBoneQuat);
  }

  if (boneIndex == ${LEFT_UPPER_ARM_BONE} || boneIndex == ${RIGHT_UPPER_ARM_BONE}) {
    float armSign = (boneIndex == ${LEFT_UPPER_ARM_BONE}) ? 1.0 : -1.0;
    float breathPhase = float(phaseSeed) + ${GameTickUniform} * 0.07;
    float breathAbduction = (0.04 + (sin(breathPhase) * 0.5 + 0.5) * 0.035 * ambientWeight) * armSign;
    float ambientSway = sin(breathPhase * 0.85 + 1.3) * 0.03 * ambientWeight * armSign;
    return multiplyQuaternions(quaternionFromPitchRoll(ambientSway, breathAbduction), clipBoneQuat);
  }

  return clipBoneQuat;
}

bool isFeatureHidden(uint boneId, uint paletteSlot, uint appearance) {
  if (paletteSlot == ${StevePaletteSlot.Beard}U && !hasBeard(appearance)) return true;
  if (paletteSlot == ${StevePaletteSlot.HairBangs}U && getHairStyle(appearance) == ${SteveHairStyle.Short}U) return true;

  bool longSleeves = hasLongSleeves(appearance);
  if (paletteSlot == ${StevePaletteSlot.LongSleeveCuff}U && !longSleeves) return true;
  if (longSleeves && isArmBone(boneId) && paletteSlot == ${StevePaletteSlot.ShirtTrim}U) return true;

  return false;
}

void applyAppearanceMorph(inout vec3 model, uint boneId, uint paletteSlot, uint appearance) {
  uint hairStyle = getHairStyle(appearance);
  if (paletteSlot == ${StevePaletteSlot.HairCrown}U) {
    if (hairStyle == ${SteveHairStyle.Fluffy}U && model.y > ${STEVE_HAIR_CROWN_MID_Y.toFixed(6)}) {
      model.y += ${(0.9 * STEVE_PIXEL_SCALE).toFixed(6)};
    }
  } else if (paletteSlot == ${StevePaletteSlot.HairBack}U && model.y < ${STEVE_HAIR_BACK_MID_Y.toFixed(6)}) {
    if (hairStyle == ${SteveHairStyle.Long}U) {
      model.y -= ${(2.4 * STEVE_PIXEL_SCALE).toFixed(6)};
    } else if (hairStyle == ${SteveHairStyle.Short}U) {
      model.y += ${(1.5 * STEVE_PIXEL_SCALE).toFixed(6)};
    }
  } else if (
    paletteSlot == ${StevePaletteSlot.HairSide}U &&
    hairStyle == ${SteveHairStyle.Short}U &&
    model.y < ${STEVE_HAIR_SIDE_MID_Y.toFixed(6)}
  ) {
    model.y += ${(0.8 * STEVE_PIXEL_SCALE).toFixed(6)};
  }

  if (hasLongSleeves(appearance) && isArmBone(boneId) && paletteSlot == ${StevePaletteSlot.ForearmSkin}U) {
    float armCenterZ = isLeftArmBone(boneId) ? -${STEVE_ARM_OFFSET_Z.toFixed(6)} : ${STEVE_ARM_OFFSET_Z.toFixed(6)};
    model.x *= 1.09;
    model.z = armCenterZ + (model.z - armCenterZ) * 1.09;
  }
}

float poseSteveModel(
  sampler2D poseAtlas,
  inout vec3 model,
  inout vec3 normal,
  uint boneId,
  uint paletteSlot,
  uint appearance,
  uint animationId,
  uint previousAnimationId,
  uint previousAnimationFrame,
  uvec2 headPoses,
  float headLookElapsedTicks,
  uint phaseSeed,
  EvaluatedClipTiming timing
) {
  if (isFeatureHidden(boneId, paletteSlot, appearance)) {
    // Collapse hidden optional cuboids to zero-area triangles so the rasterizer discards them
    model = vec3(0.0);
    return 0.0;
  }

  applyAppearanceMorph(model, boneId, paletteSlot, appearance);

  vec2 previousHeadAngles = decodeHeadPose(headPoses.x);
  vec2 targetHeadAngles = decodeHeadPose(headPoses.y);
  float headTurnProgress = smoothstep(0.0, ${STEVE_HEAD_TURN_DURATION.toFixed(1)}, headLookElapsedTicks);
  vec2 currentHeadAngles = mix(previousHeadAngles, targetHeadAngles, headTurnProgress);

  if (boneId == ${HEAD_BONE}U) {
    applyFaceMicroAnimation(model, paletteSlot, phaseSeed, timing.ambientWeight, currentHeadAngles, targetHeadAngles);
  }

  // Forward kinematics along this vertex's bone ancestor chain (zero per-animation branches)
  int bone = int(boneId);
  for (int step = 0; step < RIG_MAX_CHAIN_DEPTH; ++step) {
    if (bone < 0) break;
    vec4 clipQuat = sampleBlendedBoneQuaternion(
      poseAtlas,
      animationId,
      timing.frame,
      previousAnimationId,
      previousAnimationFrame,
      timing.blend,
      bone
    );
    vec4 finalQuat = applyProceduralBoneModifiers(bone, clipQuat, currentHeadAngles, phaseSeed, timing.ambientWeight);
    rotateAroundPivotByQuaternion(model, normal, finalQuat, RIG_BONE_PIVOTS[bone]);
    bone = RIG_BONE_PARENTS[bone];
  }

  vec4 rootMotion = sampleBlendedRootMotion(
    poseAtlas,
    animationId,
    timing.frame,
    previousAnimationId,
    previousAnimationFrame,
    timing.blend
  );
  model += rootMotion.xyz;

  float heightScale = ${STEVE_MIN_HEIGHT_SCALE.toFixed(3)} + float(getHeightStep(appearance)) * ${STEVE_HEIGHT_SCALE_STEP.toFixed(3)};
  float widthScale = ${STEVE_MIN_WIDTH_SCALE.toFixed(3)} + float(getWidthStep(appearance)) * ${STEVE_WIDTH_SCALE_STEP.toFixed(3)};
  model.y *= heightScale;
  model.xz *= widthScale;
  return rootMotion.w;
}

vec3 resolveShirtTrimColor(uint appearance, vec3 shirtColor) {
  switch (getShirtTrimStyle(appearance)) {
    case ${SteveShirtTrimStyle.CrispWhite}U:
      return vec3(0.92, 0.93, 0.95);
    case ${SteveShirtTrimStyle.Charcoal}U:
      return vec3(0.2, 0.22, 0.25);
    case ${SteveShirtTrimStyle.WarmGold}U:
      return vec3(0.88, 0.72, 0.28);
    default:
      return shirtColor * 0.76;
  }
}

vec3 resolveSteveColor(uint paletteSlot, uint appearance, uint entityId) {
  float microTint = 1.0 + hashUintToSignedUnit(entityId ^ (paletteSlot * 2654435761U)) * 0.035;
  vec3 skinColor = skinPalette[getSkinToneId(appearance)];
  vec3 hairColor = hairPalette[getHairColorId(appearance)] * microTint;
  vec3 shirtColor = shirtPalette[getShirtColorId(appearance)] * microTint;
  vec3 pantsColor = pantsPalette[getPantsColorId(appearance)] * microTint;
  vec3 shoeColor = shoePalette[getShoeColorId(appearance)];

  switch (paletteSlot) {
    case ${StevePaletteSlot.Skin}U:
      return skinColor;
    case ${StevePaletteSlot.SkinShadow}U:
      return skinColor * 0.84;
    case ${StevePaletteSlot.ForearmSkin}U:
      return hasLongSleeves(appearance) ? shirtColor : skinColor;
    case ${StevePaletteSlot.HairCrown}U:
    case ${StevePaletteSlot.HairBack}U:
    case ${StevePaletteSlot.HairSide}U:
    case ${StevePaletteSlot.HairBangs}U:
      return hairColor;
    case ${StevePaletteSlot.Beard}U:
      return mix(hairColor, skinColor * 0.6, 0.25);
    case ${StevePaletteSlot.Shirt}U:
      return shirtColor;
    case ${StevePaletteSlot.ShirtTrim}U:
    case ${StevePaletteSlot.LongSleeveCuff}U:
      return resolveShirtTrimColor(appearance, shirtColor);
    case ${StevePaletteSlot.Pants}U:
      return pantsColor;
    case ${StevePaletteSlot.PantsTrim}U:
      return pantsColor * 0.74;
    case ${StevePaletteSlot.Shoe}U:
      return shoeColor;
    case ${StevePaletteSlot.ShoeSole}U:
      return shoeColor * 0.56;
    case ${StevePaletteSlot.EyeWhite}U:
      return vec3(0.97, 0.98, 0.99);
    case ${StevePaletteSlot.EyePupil}U:
      return eyePalette[getEyeColorId(appearance)];
    default:
      return mix(skinColor * 0.65, vec3(0.56, 0.26, 0.2), 0.45);
  }
}
`

const vertexMain = (a: any) => `
vec3 model = ${a.position};
vec3 normal = ${a.normal};
uint boneId = ${a.boneAndPalette}.x;
uint paletteSlot = ${a.boneAndPalette}.y;

uint entityId = ${a.entityAndAppearance}.x;
uint appearance = ${a.entityAndAppearance}.y;
uint animationId = ${a.animationIds}.x;
uint previousAnimationId = ${a.animationIds}.y;
uint facing = ${a.facingAndPreviousFrame}.x;
uint previousAnimationFrame = ${a.facingAndPreviousFrame}.y;

float animationElapsedTicks = max(0.0, ${GameTickUniform} - float(${a.startTicks}.x));
float headLookElapsedTicks = max(0.0, ${GameTickUniform} - float(${a.startTicks}.y));
float facingElapsedTicks = max(0.0, ${GameTickUniform} - float(${a.startTicks}.z));
uint phaseSeed = (entityId & 0xFFFFU) ^ (((entityId >> 16U) & 0x7FU) * 37U);

EvaluatedClipTiming timing = evaluateClipTiming(animationId, previousAnimationFrame, animationElapsedTicks);
float verticalBlocksOffset = poseSteveModel(
  ${a.poseAtlas},
  model,
  normal,
  boneId,
  paletteSlot,
  appearance,
  animationId,
  previousAnimationId,
  previousAnimationFrame,
  ${a.headPoses},
  headLookElapsedTicks,
  phaseSeed,
  timing
);

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
${a.vertexPaletteSlot} = paletteSlot;
${a.packedAppearance} = appearance;
${a.pickedEntityId} = entityId;
`

const fragmentMain = (a: any) => `
vec3 baseColor = clamp(resolveSteveColor(${a.vertexPaletteSlot}, ${a.packedAppearance}, ${a.pickedEntityId}), 0.0, 1.0);

float light = clamp(dot(normalize(${a.worldNormal}), u_light.xyz), u_light.w, 1.0);
vec3 litColor = mix(baseColor, baseColor * light, 0.8);
uint v_entityId = ${a.pickedEntityId};
`

export const spec = {
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
      linearFiltering: true,
      clampToEdge: true,
    },
  },
  programs: {
    steve: {
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
        packedAppearance: { type: 'uint', flat: true },
        pickedEntityId: { type: 'uint', flat: true },
      },
      attributes: {
        // Per-vertex static mesh attributes (3 attribute slots, 28-byte stride)
        position: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
        normal: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
        boneAndPalette: { count: 2, type: AttrType.UShort, bindTo: { mesh: true } },

        // Per-instance dynamic attributes (6 attribute slots -> 9 total <= 16 WebGL2 limit, 36-byte stride)
        entityAndAppearance: { count: 2, type: AttrType.UInt, divisor: 1, bindTo: { instances: true } },
        startTicks: { count: 3, type: AttrType.UInt, divisor: 1, bindTo: { instances: true } },
        tilePosition: { count: 3, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        headPoses: { count: 2, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        animationIds: { count: 2, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        facingAndPreviousFrame: { count: 2, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
      },
    },
  },
} as const satisfies Spec<any, any, any, any>

export type SpecImplementation = ReturnType<typeof createFromSpec<typeof spec>>
