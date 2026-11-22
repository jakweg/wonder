import { GameTickUniform } from '@3d/common-shader'
import { AttrType } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { createSkeletalShaderSpec, declareGlslPalette } from '@3d/skeletal/shader'
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

const stevePalettesGlsl = [
  /* @__PURE__ */ declareGlslPalette('shirtPalette', STEVE_SHIRT_PALETTE),
  /* @__PURE__ */ declareGlslPalette('pantsPalette', STEVE_PANTS_PALETTE),
  /* @__PURE__ */ declareGlslPalette('hairPalette', STEVE_HAIR_PALETTE),
  /* @__PURE__ */ declareGlslPalette('skinPalette', STEVE_SKIN_PALETTE),
  /* @__PURE__ */ declareGlslPalette('eyePalette', STEVE_EYE_PALETTE),
  /* @__PURE__ */ declareGlslPalette('shoePalette', STEVE_SHOE_PALETTE),
].join('\n\n')

const steveUtilDeclarations = `
${stevePalettesGlsl}

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

void applyFaceMicroAnimation(inout vec3 model, SkeletalContext ctx) {
  if (ctx.paletteSlot == ${StevePaletteSlot.EyePupil}U) {
    vec2 eyeOffset = computeEyeOffset(ctx.phaseSeed, ctx.ambientWeight, ctx.currentHeadAngles, ctx.targetHeadAngles);
    model.z += eyeOffset.x;
    model.y += eyeOffset.y;
  }

  if (ctx.paletteSlot == ${StevePaletteSlot.EyeWhite}U || ctx.paletteSlot == ${StevePaletteSlot.EyePupil}U) {
    float blink = computeEyeBlink(ctx.phaseSeed);
    if (blink > 0.0) {
      model.y = mix(model.y, ${STEVE_EYE_BOTTOM_Y.toFixed(6)}, blink);
      model.x = mix(model.x, ${STEVE_HEAD_FRONT_RETRACT_X.toFixed(6)}, smoothstep(0.6, 1.0, blink));
    }
  }
}

vec4 applyArmBreathing(int boneIndex, vec4 boneQuat, uint phaseSeed, float ambientWeight) {
  if (boneIndex == ${LEFT_UPPER_ARM_BONE} || boneIndex == ${RIGHT_UPPER_ARM_BONE}) {
    float armSign = (boneIndex == ${LEFT_UPPER_ARM_BONE}) ? 1.0 : -1.0;
    float breathPhase = float(phaseSeed) + ${GameTickUniform} * 0.07;
    float breathAbduction = (0.04 + (sin(breathPhase) * 0.5 + 0.5) * 0.035 * ambientWeight) * armSign;
    float ambientSway = sin(breathPhase * 0.85 + 1.3) * 0.03 * ambientWeight * armSign;
    return multiplyQuaternions(quaternionFromPitchRoll(ambientSway, breathAbduction), boneQuat);
  }
  return boneQuat;
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

void scaleSteveBodyProportions(inout vec3 model, uint appearance) {
  float heightScale = ${STEVE_MIN_HEIGHT_SCALE.toFixed(3)} + float(getHeightStep(appearance)) * ${STEVE_HEIGHT_SCALE_STEP.toFixed(3)};
  float widthScale = ${STEVE_MIN_WIDTH_SCALE.toFixed(3)} + float(getWidthStep(appearance)) * ${STEVE_WIDTH_SCALE_STEP.toFixed(3)};
  model.y *= heightScale;
  model.xz *= widthScale;
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

export const steveShader = createSkeletalShaderSpec({
  skeleton: steveSkeleton,
  poseAtlasAllocation: stevePoseAtlasAllocation,
  headLook: {
    headBone: { Head: true },
  },
  extraInstanceAttributes: {
    appearance: { count: 1, type: AttrType.UInt, passToFragment: true },
  },
  utilDeclarations: steveUtilDeclarations,
  isVertexHidden: attrs => `isFeatureHidden(ctx.boneId, ctx.paletteSlot, ${attrs.appearance})`,
  preprocessVertex: attrs => `
    applyAppearanceMorph(model, ctx.boneId, ctx.paletteSlot, ${attrs.appearance});
    if (ctx.boneId == ${HEAD_BONE}U) {
      applyFaceMicroAnimation(model, ctx);
    }`,
  modifyBoneQuaternion: () => 'applyArmBreathing(boneIndex, boneQuat, ctx.phaseSeed, ctx.ambientWeight)',
  postprocessPosedModel: attrs => `scaleSteveBodyProportions(model, ${attrs.appearance});`,
  resolveFragmentColor: attrs => `resolveSteveColor(paletteSlot, ${attrs.appearance}, entityId)`,
})
