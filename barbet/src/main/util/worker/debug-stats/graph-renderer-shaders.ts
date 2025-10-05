import { PrecisionHeader, VersionHeader } from '@3d/common-shader'
import { AttrType, createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import { TextureSlot } from '@3d/texture-slot-counter'

const createPositions = (p1x: number, p2x: number): string => {
  const m1x = p1x.toFixed(5)
  const m1y = '-1.00000'
  const m2x = p2x.toFixed(5)
  const m2y = '1.00000' // 1 .toFixed(5) // eslint likes to simplify it to `1.toFixed(5)`
  const width = 1 / Math.abs(p1x - p2x)

  return `
const float left = ${m1x};
const float width = ${width.toFixed(5)};
const vec2 positions[] = vec2[6](
vec2(${m1x}, ${m2y}),
vec2(${m1x}, ${m1y}),
vec2(${m2x}, ${m1y}),
vec2(${m2x}, ${m2y}),
vec2(${m1x}, ${m2y}),
vec2(${m2x}, ${m1y})
);`
}

const vertexSource = (a: any) => `
vec2 screenPosition = positions[gl_VertexID];
float shift = getValue(0) / float(${a.samplesCount}) + a_dummyZero;
float x = (screenPosition.x - left) * width - a_dummyZero;
${a.position} = vec2(
    x + shift,
    (screenPosition.y / 2.0 + 0.5) * ${a.heightScale});

vec3 position3d = vec3(screenPosition.x, screenPosition.y, 0.0);
`
const fragmentSource = (a: any) => `
int index = int(${a.position}.x * float(${a.samplesCount}));
int trueIndex = 1 + index * 2 + (index >= int(${a.samplesCount}) ? -int(${a.samplesCount}) * 2 : 0);
float myValue = getValue(trueIndex);
float elapsedTime = getValue(trueIndex + 1);

vec4 finalColor;
if (abs(${a.position}.y - ${a.targetMs}) < 0.003 * ${a.heightScale})
    finalColor = vec4(1.0, 0.0, 0.0, 1.0);
else if (${a.position}.y > myValue) {
  if (abs(${a.position}.y - elapsedTime) > 0.002 * ${a.heightScale}) 
    discard;
  else
    finalColor = vec4(1.0, 1.0, 1.0, 0.6);
} else if (myValue > ${a.targetMs} * 0.95) 
    finalColor = vec4(1.0, 0.3, 0.4, 0.9);
else if (myValue > ${a.targetMs} * 0.5) 
    finalColor = vec4(0.9, 0.6, 0.3, 0.9);
else
    finalColor = vec4(0.1, 0.8, 0.4, 0.9);
`

export const spec = {
  textures: {
    fpsSamples: { textureSlot: TextureSlot.Debug_FPSStats, float32: true },
    tpsSamples: { textureSlot: TextureSlot.Debug_FPSStats, float32: true },
  },
  programs: {
    tps: {
      uniforms: {
        heightScale: { type: 'float' },
        targetMs: { type: 'float' },
        samplesCount: { type: 'uint' },
      },

      utilDeclarations: a => `
${createPositions(0.2, 1)}
float getValue(int index) { return texelFetch(${a.fpsSamples}, ivec2(index, 0), 0).r; }
`,

      skipWorldTransform: true,
      vertexFinalPosition: 'position3d',
      vertexMain: vertexSource,
      fragmentMain: fragmentSource,
      fragmentFinalColor: 'finalColor',

      attributes: {
        dummyZero: { count: 1, type: AttrType.Float, disabled: true },
      },

      varyings: {
        position: { type: 'vec2' },
      },

      textureSamplers: {
        fpsSamples: {},
      },
    },
    fps: {
      uniforms: {
        heightScale: { type: 'float' },
        targetMs: { type: 'float' },
        samplesCount: { type: 'uint' },
      },

      utilDeclarations: a => `
${createPositions(-1, -0.2)}
float getValue(int index) { return texelFetch(${a.tpsSamples}, ivec2(index, 0), 0).r; }
`,

      skipWorldTransform: true,
      vertexFinalPosition: 'position3d',
      vertexMain: vertexSource,
      fragmentMain: fragmentSource,
      fragmentFinalColor: 'finalColor',

      attributes: {
        dummyZero: { count: 1, type: AttrType.Float, disabled: true },
      },

      varyings: {
        position: { type: 'vec2' },
      },

      textureSamplers: {
        tpsSamples: {},
      },
    },
  },
} satisfies Spec<never, 'fps' | 'tps', 'heightScale' | 'targetMs' | 'samplesCount', 'fpsSamples' | 'tpsSamples'>
export type SpecImplementation = ReturnType<typeof createFromSpec<typeof spec>>
