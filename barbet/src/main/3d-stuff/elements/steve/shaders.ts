import {
  GameTickUniform,
  PIConstantHeader,
  RotationVectorsDeclaration,
  TerrainHeightMultiplierUniform,
} from '@3d/common-shader'
import { AttrType, createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import {
  WALK_DOWN_STEP_DURATION,
  WALK_STEP_DURATION,
  WALK_UP_STEP_DURATION,
  WAVING_HAND_DURATION,
} from '@game/new-entities/activities/steve/constants'
import {
  STEVE_HEAD_CENTER_BYTE,
  STEVE_HEAD_MAX_PITCH,
  STEVE_HEAD_MAX_YAW,
  STEVE_HEAD_TURN_DURATION,
  SteveAnimationId,
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
import {
  STEVE_ARM_OFFSET_Z,
  STEVE_ELBOW_Y,
  STEVE_EYE_BOTTOM_Y,
  STEVE_HAIR_BACK_MID_Y,
  STEVE_HAIR_CROWN_MID_Y,
  STEVE_HAIR_SIDE_MID_Y,
  STEVE_HEAD_FRONT_RETRACT_X,
  STEVE_HIP_Y,
  STEVE_KNEE_Y,
  STEVE_LEG_OFFSET_Z,
  STEVE_NECK_Y,
  STEVE_PIXEL_SCALE,
  STEVE_SHOULDER_Y,
  SteveColorId,
  SteveMeshPart,
} from './mesh'

const TURN_DURATION = 5

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

struct SteveMotion {
  float walkSwing;
  float walkBounce;
  float climbPulse;
  float dropPulse;
  float crouchAngle;
  float waveRaise;
  float waveOscillation;
};

mat3 rotateAroundX(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

mat3 rotateAroundY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotateAroundZ(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

void rotateAroundPivot(inout vec3 position, inout vec3 normal, mat3 rotation, vec3 pivot) {
  position = pivot + rotation * (position - pivot);
  normal = rotation * normal;
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

bool isWalkAnimation(uint animationId) {
  return animationId == ${SteveAnimationId.Walk}U
    || animationId == ${SteveAnimationId.WalkUp}U
    || animationId == ${SteveAnimationId.WalkDown}U;
}

bool isArmPart(uint partId) {
  return partId >= ${SteveMeshPart.LeftUpperArm}U && partId <= ${SteveMeshPart.RightForearm}U;
}

bool isLeftArmPart(uint partId) {
  return partId == ${SteveMeshPart.LeftUpperArm}U || partId == ${SteveMeshPart.LeftForearm}U;
}

float getWalkDuration(uint animationId) {
  if (animationId == ${SteveAnimationId.WalkUp}U) {
    return ${WALK_UP_STEP_DURATION.toFixed(1)};
  }
  if (animationId == ${SteveAnimationId.WalkDown}U) {
    return ${WALK_DOWN_STEP_DURATION.toFixed(1)};
  }
  return ${WALK_STEP_DURATION.toFixed(1)};
}

float computeFacingAngle(uint packedFacing, float elapsedTicks) {
  int currentDirection = int(packedFacing & 7U);
  int previousDirection = int((packedFacing >> 3U) & 7U);

  int deltaSteps = currentDirection - previousDirection;
  if (deltaSteps > 4) {
    deltaSteps -= 8;
  } else if (deltaSteps < -4) {
    deltaSteps += 8;
  }

  float progress = smoothstep(0.0, ${TURN_DURATION.toFixed(1)}, elapsedTicks);
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

vec2 computeEyeOffset(uint phaseSeed, uint animationId, vec2 currentAngles, vec2 targetAngles) {
  float eyeStepTime = max(0.0, (${GameTickUniform} + float(phaseSeed & 31U)) / 36.0);
  uint stepIndex = uint(floor(eyeStepTime));
  float dartBlend = smoothstep(0.86, 1.0, fract(eyeStepTime));

  vec2 saccadePixels = mix(
    sampleEyeSaccadePixels(phaseSeed, stepIndex),
    sampleEyeSaccadePixels(phaseSeed, stepIndex + 1U),
    dartBlend
  );
  if (isWalkAnimation(animationId)) {
    saccadePixels *= 0.25;
  }

  // Eyes lead head rotation toward target gaze, then settle naturally
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

bool isFeatureHidden(uint partId, uint colorId, uint appearance) {
  if (colorId == ${SteveColorId.Beard}U && !hasBeard(appearance)) {
    return true;
  }
  if (colorId == ${SteveColorId.HairBangs}U && getHairStyle(appearance) == ${SteveHairStyle.Short}U) {
    return true;
  }

  bool longSleeves = hasLongSleeves(appearance);
  if (colorId == ${SteveColorId.LongSleeveCuff}U && !longSleeves) {
    return true;
  }
  if (longSleeves && isArmPart(partId) && colorId == ${SteveColorId.ShirtTrim}U) {
    return true;
  }

  return false;
}

void applyAppearanceMorph(inout vec3 model, uint partId, uint colorId, uint appearance) {
  uint hairStyle = getHairStyle(appearance);
  if (colorId == ${SteveColorId.HairCrown}U) {
    if (hairStyle == ${SteveHairStyle.Fluffy}U && model.y > ${STEVE_HAIR_CROWN_MID_Y.toFixed(6)}) {
      model.y += ${(0.9 * STEVE_PIXEL_SCALE).toFixed(6)};
    }
  } else if (colorId == ${SteveColorId.HairBack}U && model.y < ${STEVE_HAIR_BACK_MID_Y.toFixed(6)}) {
    if (hairStyle == ${SteveHairStyle.Long}U) {
      model.y -= ${(2.4 * STEVE_PIXEL_SCALE).toFixed(6)};
    } else if (hairStyle == ${SteveHairStyle.Short}U) {
      model.y += ${(1.5 * STEVE_PIXEL_SCALE).toFixed(6)};
    }
  } else if (
    colorId == ${SteveColorId.HairSide}U &&
    hairStyle == ${SteveHairStyle.Short}U &&
    model.y < ${STEVE_HAIR_SIDE_MID_Y.toFixed(6)}
  ) {
    model.y += ${(0.8 * STEVE_PIXEL_SCALE).toFixed(6)};
  }

  if (hasLongSleeves(appearance) && isArmPart(partId) && colorId == ${SteveColorId.ForearmSkin}U) {
    float armCenterZ = isLeftArmPart(partId) ? -${STEVE_ARM_OFFSET_Z.toFixed(6)} : ${STEVE_ARM_OFFSET_Z.toFixed(6)};
    model.x *= 1.09;
    model.z = armCenterZ + (model.z - armCenterZ) * 1.09;
  }
}

SteveMotion computeSteveMotion(uint animationId, float elapsedTicks) {
  SteveMotion motion = SteveMotion(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  if (isWalkAnimation(animationId)) {
    float progress = clamp(elapsedTicks / getWalkDuration(animationId), 0.0, 1.0);
    motion.walkSwing = sin(progress * (2.0 * PI));

    if (animationId == ${SteveAnimationId.WalkUp}U) {
      motion.climbPulse = smoothPulse(0.22, 0.4, 0.5, 0.68, progress);
      float preJumpCrouch = smoothPulse(0.1, 0.23, 0.23, 0.3, progress);
      float landCrouch = smoothPulse(0.61, 0.68, 0.68, 0.84, progress);
      motion.crouchAngle = preJumpCrouch * 0.22 + landCrouch * 0.24;
      float groundedMask = (progress < 0.28 || progress > 0.64) ? 1.0 : 0.0;
      motion.walkBounce = abs(motion.walkSwing) * 0.015 * groundedMask;
    } else if (animationId == ${SteveAnimationId.WalkDown}U) {
      motion.dropPulse = smoothPulse(0.22, 0.44, 0.44, 0.78, progress);
      motion.crouchAngle = smoothPulse(0.76, 0.85, 0.85, 0.98, progress) * 0.22;
      motion.walkBounce = abs(motion.walkSwing) * 0.015;
    } else {
      motion.walkBounce = abs(motion.walkSwing) * 0.022;
    }
  } else if (animationId == ${SteveAnimationId.WavingHand}U) {
    float waveProgress = clamp(elapsedTicks / ${WAVING_HAND_DURATION.toFixed(1)}, 0.0, 1.0);
    motion.waveRaise = smoothPulse(0.0, 0.18, 0.82, 1.0, waveProgress);
    float waveEnvelope = smoothPulse(0.14, 0.24, 0.76, 0.86, waveProgress);
    motion.waveOscillation = sin((waveProgress - 0.18) * (3.5 * 2.0 * PI / 0.64)) * waveEnvelope;
  }

  return motion;
}

void applyHeadPose(
  inout vec3 model,
  inout vec3 normal,
  uint colorId,
  uint animationId,
  uint phaseSeed,
  uint previousHeadPose,
  uint targetHeadPose,
  float stepPitchBias,
  float elapsedTicks
) {
  vec2 previousAngles = decodeHeadPose(previousHeadPose);
  vec2 targetAngles = decodeHeadPose(targetHeadPose);
  float progress = smoothstep(0.0, ${STEVE_HEAD_TURN_DURATION.toFixed(1)}, elapsedTicks);
  vec2 angles = mix(previousAngles, targetAngles, progress);
  angles.y += stepPitchBias;
  targetAngles.y += stepPitchBias;

  if (colorId == ${SteveColorId.EyePupil}U) {
    vec2 eyeOffset = computeEyeOffset(phaseSeed, animationId, angles, targetAngles);
    model.z += eyeOffset.x;
    model.y += eyeOffset.y;
  }

  if (colorId == ${SteveColorId.EyeWhite}U || colorId == ${SteveColorId.EyePupil}U) {
    float blink = computeEyeBlink(phaseSeed);
    if (blink > 0.0) {
      model.y = mix(model.y, ${STEVE_EYE_BOTTOM_Y.toFixed(6)}, blink);
      model.x = mix(model.x, ${STEVE_HEAD_FRONT_RETRACT_X.toFixed(6)}, smoothstep(0.6, 1.0, blink));
    }
  }

  mat3 headRotation = rotateAroundY(angles.x) * rotateAroundZ(angles.y);
  rotateAroundPivot(model, normal, headRotation, vec3(0.0, ${STEVE_NECK_Y.toFixed(6)}, 0.0));
}

void applyArmPose(
  inout vec3 model,
  inout vec3 normal,
  uint partId,
  uint animationId,
  uint phaseSeed,
  SteveMotion motion
) {
  bool isLeftArm = isLeftArmPart(partId);
  bool isForearm = partId == ${SteveMeshPart.LeftForearm}U || partId == ${SteveMeshPart.RightForearm}U;
  float armSign = isLeftArm ? 1.0 : -1.0;
  float armCenterZ = -armSign * ${STEVE_ARM_OFFSET_Z.toFixed(6)};

  float breathPhase = float(phaseSeed) + ${GameTickUniform} * 0.07;
  float balanceAbduction = motion.dropPulse * 0.22 + motion.climbPulse * 0.12;
  float shoulderAbduction = (0.04 + (sin(breathPhase) * 0.5 + 0.5) * 0.035 + balanceAbduction) * armSign;
  float ambientSway = sin(breathPhase * 0.85 + 1.3) * 0.03 * armSign;

  float armAmplitude = (animationId == ${SteveAnimationId.WalkUp}U) ? 0.56 : 0.4;
  float walkArmSwing = -motion.walkSwing * armAmplitude * armSign;
  float shoulderPitch = walkArmSwing + ambientSway;

  float elbowPitch = max(0.0, walkArmSwing) * 0.4 + abs(motion.walkSwing) * 0.08 + motion.climbPulse * 0.25;
  float elbowWaveRoll = 0.0;

  bool wavesWithLeftArm = (phaseSeed & 1U) == 0U;
  if (motion.waveRaise > 0.0 && isLeftArm == wavesWithLeftArm) {
    shoulderAbduction += motion.waveRaise * 2.05 * armSign;
    shoulderPitch += motion.waveRaise * 0.28;
    elbowWaveRoll = (motion.waveRaise * 0.78 + motion.waveOscillation * 0.38) * armSign;
    elbowPitch += motion.waveRaise * 0.12;
  }

  if (isForearm && (elbowPitch != 0.0 || elbowWaveRoll != 0.0)) {
    mat3 elbowRotation = rotateAroundZ(elbowPitch) * rotateAroundX(elbowWaveRoll);
    rotateAroundPivot(model, normal, elbowRotation, vec3(0.0, ${STEVE_ELBOW_Y.toFixed(6)}, armCenterZ));
  }

  mat3 shoulderRotation = rotateAroundZ(shoulderPitch) * rotateAroundX(shoulderAbduction);
  rotateAroundPivot(model, normal, shoulderRotation, vec3(0.0, ${STEVE_SHOULDER_Y.toFixed(6)}, armCenterZ));
}

void applyLegPose(
  inout vec3 model,
  inout vec3 normal,
  uint partId,
  uint animationId,
  SteveMotion motion
) {
  bool isLeftLeg = partId == ${SteveMeshPart.LeftThigh}U || partId == ${SteveMeshPart.LeftShin}U;
  bool isShin = partId == ${SteveMeshPart.LeftShin}U || partId == ${SteveMeshPart.RightShin}U;
  float legSign = isLeftLeg ? 1.0 : -1.0;
  float legCenterZ = -legSign * ${STEVE_LEG_OFFSET_Z.toFixed(6)};
  float signedSwing = motion.walkSwing * legSign;

  float hipAngle = 0.0;
  float kneeBend = 0.0;

  if (signedSwing >= 0.0) {
    float forwardHipScale = (animationId == ${SteveAnimationId.WalkUp}U) ? 0.56 : 0.38;
    hipAngle = signedSwing * forwardHipScale;
    kneeBend = signedSwing * (1.0 - signedSwing) * 0.35;
    if (animationId == ${SteveAnimationId.WalkUp}U) {
      kneeBend += signedSwing * motion.climbPulse * 0.55;
    }
  } else {
    float backwardAmount = -signedSwing;
    hipAngle = -backwardAmount * 0.32;
    kneeBend = backwardAmount * 0.48;
    if (animationId == ${SteveAnimationId.WalkUp}U) {
      kneeBend += backwardAmount * motion.climbPulse * 0.2;
    }
  }

  hipAngle += motion.crouchAngle;
  kneeBend += 2.0 * motion.crouchAngle;

  if (isShin && kneeBend != 0.0) {
    rotateAroundPivot(model, normal, rotateAroundZ(-kneeBend), vec3(0.0, ${STEVE_KNEE_Y.toFixed(6)}, legCenterZ));
  }
  if (hipAngle != 0.0) {
    rotateAroundPivot(model, normal, rotateAroundZ(hipAngle), vec3(0.0, ${STEVE_HIP_Y.toFixed(6)}, legCenterZ));
  }
}

void applyStevePose(
  inout vec3 model,
  inout vec3 normal,
  uint partId,
  uint colorId,
  uint animationId,
  uint phaseSeed,
  uint previousHeadPose,
  uint targetHeadPose,
  float elapsedTicks
) {
  SteveMotion motion = computeSteveMotion(animationId, elapsedTicks);
  float stepHeadPitch = motion.climbPulse * 0.14 - motion.dropPulse * 0.14 + motion.waveRaise * 0.07;

  if (partId == ${SteveMeshPart.Head}U) {
    applyHeadPose(
      model,
      normal,
      colorId,
      animationId,
      phaseSeed,
      previousHeadPose,
      targetHeadPose,
      stepHeadPitch,
      elapsedTicks
    );
  } else if (partId >= ${SteveMeshPart.LeftThigh}U) {
    applyLegPose(model, normal, partId, animationId, motion);
  } else if (isArmPart(partId)) {
    applyArmPose(model, normal, partId, animationId, phaseSeed, motion);
  }

  float torsoLean = -motion.climbPulse * 0.16 + motion.dropPulse * 0.06 - motion.crouchAngle * 0.25;
  if (torsoLean != 0.0 && partId <= ${SteveMeshPart.RightForearm}U) {
    rotateAroundPivot(model, normal, rotateAroundZ(torsoLean), vec3(0.0, ${STEVE_HIP_Y.toFixed(6)}, 0.0));
  }

  float crouchDrop = 12.0 * ${STEVE_PIXEL_SCALE.toFixed(6)} * (1.0 - cos(motion.crouchAngle));
  model.y += motion.walkBounce - crouchDrop;
}

vec3 computeWalkWorldOffset(uint animationId, uint packedFacing, float elapsedTicks) {
  if (!isWalkAnimation(animationId)) {
    return vec3(0.0);
  }

  float progress = clamp(elapsedTicks / getWalkDuration(animationId), 0.0, 1.0);
  uint currentDirection = packedFacing & 7U;
  float verticalBlocksOffset = 0.0;

  if (animationId == ${SteveAnimationId.WalkUp}U) {
    if (progress < 0.28) {
      verticalBlocksOffset = -1.0;
    } else if (progress < 0.64) {
      float jumpTime = (progress - 0.28) / 0.36;
      verticalBlocksOffset = -1.0 + 3.28 * jumpTime - 2.28 * jumpTime * jumpTime;
    }
  } else if (animationId == ${SteveAnimationId.WalkDown}U) {
    float dropCurve = smoothstep(0.38, 0.84, progress);
    float stepOffArc = smoothPulse(0.22, 0.44, 0.44, 0.78, progress);
    verticalBlocksOffset = (1.0 - dropCurve) + stepOffArc * 0.16;
  }

  vec3 offset = rotationVectors[currentDirection] * (progress - 1.0);
  offset.y = verticalBlocksOffset * ${TerrainHeightMultiplierUniform};
  return offset;
}

vec3 resolveSteveColor(uint colorId, uint appearance, uint entityId) {
  float microTint = 1.0 + hashUintToSignedUnit(entityId ^ (colorId * 2654435761U)) * 0.035;

  vec3 skinColor = skinPalette[getSkinToneId(appearance)];
  vec3 hairColor = hairPalette[getHairColorId(appearance)] * microTint;
  vec3 shirtColor = shirtPalette[getShirtColorId(appearance)] * microTint;
  vec3 pantsColor = pantsPalette[getPantsColorId(appearance)] * microTint;
  vec3 eyeColor = eyePalette[getEyeColorId(appearance)];
  vec3 shoeColor = shoePalette[getShoeColorId(appearance)];

  if (colorId == ${SteveColorId.Skin}U) {
    return skinColor;
  }
  if (colorId == ${SteveColorId.SkinShadow}U) {
    return skinColor * 0.84;
  }
  if (colorId == ${SteveColorId.ForearmSkin}U) {
    return hasLongSleeves(appearance) ? shirtColor : skinColor;
  }
  if (
    colorId == ${SteveColorId.HairCrown}U ||
    colorId == ${SteveColorId.HairBack}U ||
    colorId == ${SteveColorId.HairSide}U ||
    colorId == ${SteveColorId.HairBangs}U
  ) {
    return hairColor;
  }
  if (colorId == ${SteveColorId.Beard}U) {
    return mix(hairColor, skinColor * 0.6, 0.25);
  }
  if (colorId == ${SteveColorId.Shirt}U) {
    return shirtColor;
  }
  if (colorId == ${SteveColorId.ShirtTrim}U || colorId == ${SteveColorId.LongSleeveCuff}U) {
    uint trimStyle = getShirtTrimStyle(appearance);
    if (trimStyle == ${SteveShirtTrimStyle.CrispWhite}U) {
      return vec3(0.92, 0.93, 0.95);
    }
    if (trimStyle == ${SteveShirtTrimStyle.Charcoal}U) {
      return vec3(0.2, 0.22, 0.25);
    }
    if (trimStyle == ${SteveShirtTrimStyle.WarmGold}U) {
      return vec3(0.88, 0.72, 0.28);
    }
    return shirtColor * 0.76;
  }
  if (colorId == ${SteveColorId.Pants}U) {
    return pantsColor;
  }
  if (colorId == ${SteveColorId.PantsTrim}U) {
    return pantsColor * 0.74;
  }
  if (colorId == ${SteveColorId.Shoe}U) {
    return shoeColor;
  }
  if (colorId == ${SteveColorId.ShoeSole}U) {
    return shoeColor * 0.56;
  }
  if (colorId == ${SteveColorId.EyeWhite}U) {
    return vec3(0.97, 0.98, 0.99);
  }
  if (colorId == ${SteveColorId.EyePupil}U) {
    return eyeColor;
  }
  return mix(skinColor * 0.65, vec3(0.56, 0.26, 0.2), 0.45);
}
`

const vertexMain = (a: any) => `
vec3 model = ${a.position};
vec3 normal = ${a.normal};

float elapsedTicks = max(0.0, ${GameTickUniform} - float(${a.animationStartTick}));
uint phaseSeed = (${a.entityId} & 0xFFFFU) ^ (((${a.entityId} >> 16U) & 0x7FU) * 37U);

if (isFeatureHidden(${a.partId}, ${a.colorId}, ${a.appearance})) {
  // Collapse hidden optional cuboids to zero-area triangles so the rasterizer discards them
  model = vec3(0.0);
} else {
  applyAppearanceMorph(model, ${a.partId}, ${a.colorId}, ${a.appearance});
  applyStevePose(
    model,
    normal,
    ${a.partId},
    ${a.colorId},
    ${a.animationId},
    phaseSeed,
    ${a.previousHeadPose},
    ${a.targetHeadPose},
    elapsedTicks
  );

  float heightScale = ${STEVE_MIN_HEIGHT_SCALE.toFixed(3)} + float(getHeightStep(${a.appearance})) * ${STEVE_HEIGHT_SCALE_STEP.toFixed(3)};
  float widthScale = ${STEVE_MIN_WIDTH_SCALE.toFixed(3)} + float(getWidthStep(${a.appearance})) * ${STEVE_WIDTH_SCALE_STEP.toFixed(3)};
  model.y *= heightScale;
  model.xz *= widthScale;
}

mat3 facingRotation = rotateAroundY(computeFacingAngle(${a.facing}, elapsedTicks));
model = facingRotation * model;
normal = facingRotation * normal;

vec3 worldPosition = model + vec3(
  float(${a.positionXZ}.x) + 0.5,
  float(${a.positionY}) * ${TerrainHeightMultiplierUniform},
  float(${a.positionXZ}.y) + 0.5
);
worldPosition += computeWalkWorldOffset(${a.animationId}, ${a.facing}, elapsedTicks);

${a.worldNormal} = normal;
${a.partColorId} = ${a.colorId};
${a.packedAppearance} = ${a.appearance};
${a.pickedEntityId} = ${a.entityId};
`

const fragmentMain = (a: any) => `
vec3 baseColor = clamp(resolveSteveColor(${a.partColorId}, ${a.packedAppearance}, ${a.pickedEntityId}), 0.0, 1.0);

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
  programs: {
    steve: {
      utilDeclarations,
      vertexMain,
      vertexFinalPosition: 'worldPosition',
      fragmentMain,
      fragmentFinalColor: 'vec4(litColor, 1.0)',
      fragmentEntityId: 'v_entityId',
      varyings: {
        worldNormal: { type: 'vec3' },
        partColorId: { type: 'uint', flat: true },
        packedAppearance: { type: 'uint', flat: true },
        pickedEntityId: { type: 'uint', flat: true },
      },
      attributes: {
        // Per-vertex static mesh attributes
        position: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
        normal: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
        partId: { count: 1, type: AttrType.UInt, bindTo: { mesh: true } },
        colorId: { count: 1, type: AttrType.UInt, bindTo: { mesh: true } },

        // Per-instance dynamic attributes
        entityId: { count: 1, type: AttrType.UInt, divisor: 1, bindTo: { instances: true } },
        animationStartTick: { count: 1, type: AttrType.UInt, divisor: 1, bindTo: { instances: true } },
        appearance: { count: 1, type: AttrType.UInt, divisor: 1, bindTo: { instances: true } },
        positionXZ: { count: 2, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        positionY: { count: 1, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        previousHeadPose: { count: 1, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        targetHeadPose: { count: 1, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        facing: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
        animationId: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
      },
    },
  },
} as const satisfies Spec<any, any, any, never>

export type SpecImplementation = ReturnType<typeof createFromSpec<typeof spec>>
