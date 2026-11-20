import {
  GameTickUniform,
  PIConstantHeader,
  RenderTimeUniform,
  TerrainHeightMultiplierUniform,
} from '@3d/common-shader'
import { AttrType, createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { JUMP_DURATION, SLOW_ROTATE_DURATION } from '@game/activities/slime/constants'
import { SlimeAnimationId } from '@game/new-entities/stores/slime-animation'
import { SLIME_COLOR_PALETTE } from '@game/new-entities/stores/slime-metadata'
import { SlimeMeshPart } from './mesh'

const IDLE_ROTATE_DURATION = 5

const slimePaletteGlsl = /* @__PURE__ */ SLIME_COLOR_PALETTE.map(hex => {
  const red = (((hex >> 16) & 0xff) / 255).toFixed(6)
  const green = (((hex >> 8) & 0xff) / 255).toFixed(6)
  const blue = (((hex >> 0) & 0xff) / 255).toFixed(6)
  return `vec3(${red}, ${green}, ${blue})`
})

const utilDeclarations = () => `
${PIConstantHeader()}

const vec3 slimePalette[${slimePaletteGlsl.length}] = vec3[${slimePaletteGlsl.length}](
  ${slimePaletteGlsl.join(',\n  ')}
);

mat3 rotateAroundY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

vec3 animateMouth(vec3 model, uint partId) {
  if (partId == ${SlimeMeshPart.Mouth}U) {
    float x = (sin(${RenderTimeUniform}) + 1.0) * 0.5;
    float x2 = x * x;
    float x4 = x2 * x2;
    float x8 = x4 * x4;
    float x16 = x8 * x8;
    float pulse = x16 * x4 + 1.0;
    model.z *= pulse;
  }
  return model;
}

float computeFacingAngle(uint packedFacing, uint animationId, float elapsedTicks, float modelY) {
  int currentDirection = int(packedFacing & 7U);
  int previousDirection = int((packedFacing >> 3U) & 7U);

  int deltaSteps = currentDirection - previousDirection;
  if (deltaSteps > 4) {
    deltaSteps -= 8;
  } else if (deltaSteps < -4) {
    deltaSteps += 8;
  }

  float duration = ${IDLE_ROTATE_DURATION.toFixed(1)};
  if (animationId == ${SlimeAnimationId.SlowRotate}U) {
    duration = ${SLOW_ROTATE_DURATION.toFixed(1)} - modelY * 5.0;
  } else if (animationId == ${SlimeAnimationId.Jump}U) {
    duration = ${JUMP_DURATION.toFixed(1)};
  }

  float progress = smoothstep(0.0, 1.0, smoothstep(0.0, duration, elapsedTicks));
  float interpolatedDirection = float(previousDirection) + float(deltaSteps) * progress;
  return interpolatedDirection * (PI * 0.25);
}

vec3 applyIdleMotion(vec3 model, float phase) {
  float breath = (sin(phase + ${RenderTimeUniform}) * 0.5 + 0.5) * 0.1;
  model.y += (model.y + 0.5) * breath;

  float s = sin(phase + ${RenderTimeUniform} * (0.7 + fract(phase / 9.0)));
  float s2 = s * s;
  float s4 = s2 * s2;
  float s8 = s4 * s4;
  float s16 = s8 * s8;
  float lookPulse = s16 * s8 * s;
  float lookAngle = lookPulse * (model.y + 0.5) * 0.3;
  return rotateAroundY(lookAngle) * model;
}

vec3 applyJumpMotion(vec3 model, uint animationId, float elapsedTicks) {
  if (animationId != ${SlimeAnimationId.Jump}U) {
    return model;
  }

  float progress = clamp(elapsedTicks / ${JUMP_DURATION.toFixed(1)}, 0.0, 1.0);
  float jumpPhase = clamp((progress - 0.5) * 1.6 + 0.5, 0.0, 1.0);
  float jumpArc = jumpPhase * (1.0 - jumpPhase);

  float p = progress;
  float squashStretch = -p * p * (p - 1.0) * (p - 1.0) * (p - 0.3) * (p - 0.7) * sin(PI * p);

  model.y += jumpArc * 6.0 * ${TerrainHeightMultiplierUniform} + (model.y + 0.5) * squashStretch * 100.0;
  return model;
}

vec3 placeInWorld(vec3 model, uint size, uvec2 positionXZ, uint positionY) {
  float scale = float(size) / 2.0;
  model.y += 0.5;
  model *= scale;
  model.y -= 0.5;

  model += vec3(
    float(positionXZ.x) + 0.5,
    float(positionY) * ${TerrainHeightMultiplierUniform} + 0.5,
    float(positionXZ.y) + 0.5
  );
  return model;
}
`

const vertexMain = (a: any) => `
vec3 model = animateMouth(${a.position}, ${a.partId});
vec3 normal = ${a.normal};

float elapsedTicks = max(0.0, ${GameTickUniform} - float(${a.animationStartTick}));
float facingAngle = computeFacingAngle(${a.facing}, ${a.animationId}, elapsedTicks, model.y);
mat3 facingRotation = rotateAroundY(facingAngle);
model = facingRotation * model;
normal = facingRotation * normal;

uint phaseSeed = (${a.entityId} & 0xFFFFU) ^ (((${a.entityId} >> 16U) & 0x7FU) * 37U);
model = applyIdleMotion(model, float(phaseSeed));
model = applyJumpMotion(model, ${a.animationId}, elapsedTicks);

uint size = (${a.sizeAndColor} >> 4U) & 0xFU;
vec3 worldPosition = placeInWorld(model, size, ${a.positionXZ}, ${a.positionY});

${a.worldNormal} = normal;
${a.facePartId} = ${a.partId};
${a.colorId} = ${a.sizeAndColor} & 0xFU;
${a.pickedEntityId} = ${a.entityId};
`

const fragmentMain = (a: any) => `
vec3 baseColor = (${a.facePartId} == ${SlimeMeshPart.Body}U)
  ? slimePalette[${a.colorId} & 0xFU]
  : vec3(0.07);

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
    slime: {
      utilDeclarations,
      vertexMain,
      vertexFinalPosition: 'worldPosition',
      fragmentMain,
      fragmentFinalColor: 'vec4(litColor, 1.0)',
      fragmentEntityId: 'v_entityId',
      varyings: {
        worldNormal: { type: 'vec3' },
        facePartId: { type: 'uint', flat: true },
        colorId: { type: 'uint', flat: true },
        pickedEntityId: { type: 'uint', flat: true },
      },
      attributes: {
        // Per-vertex static mesh attributes
        position: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
        normal: { count: 3, type: AttrType.Float, bindTo: { mesh: true } },
        partId: { count: 1, type: AttrType.UInt, bindTo: { mesh: true } },

        // Per-instance dynamic attributes
        entityId: { count: 1, type: AttrType.UInt, divisor: 1, bindTo: { instances: true } },
        animationStartTick: { count: 1, type: AttrType.UInt, divisor: 1, bindTo: { instances: true } },
        positionXZ: { count: 2, type: AttrType.UShort, divisor: 1, bindTo: { instances: true } },
        positionY: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
        sizeAndColor: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
        facing: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
        animationId: { count: 1, type: AttrType.UByte, divisor: 1, bindTo: { instances: true } },
      },
    },
  },
} as const satisfies Spec<any, any, any, never>

export type SpecImplementation = ReturnType<typeof createFromSpec<typeof spec>>
