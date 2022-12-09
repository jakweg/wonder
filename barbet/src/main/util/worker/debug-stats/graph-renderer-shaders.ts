import { PrecisionHeader, VersionHeader } from '@3d/common-shader'

interface Options {
  left: boolean
  samplesCount: number
}

const createPositions = (p1x: number, p2x: number): string => {
  const m1x = p1x.toFixed(5)
  const m1y = (-1).toFixed(5)
  const m2x = p2x.toFixed(5)
  const m2y = (0 + 1).toFixed(5) // trick esbuild to work properly
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

export const vertexShaderSource = (options: Options): string => {
  const parts: string[] = []
  parts.push(`${VersionHeader()}
${PrecisionHeader()}

in float a_dummyZero;
out vec2 v_position;
uniform float u_values[${options.samplesCount * 2 + 1}];
uniform float u_heightScale;

${options.left ? createPositions(-1, -0.2) : createPositions(0.2, 1)}

void main() {
    vec2 screenPosition = positions[gl_VertexID];
    float shift = u_values[0] / ${options.samplesCount.toFixed(1)} + a_dummyZero;
    float x = (screenPosition.x - left) * width;
    v_position = vec2(
        x + shift,
        (screenPosition.y / 2.0 + 0.5) * u_heightScale);

    gl_Position = vec4(screenPosition.xy, 0.0, 1.0);
}
	`)
  return parts.join('')
}

export const fragmentShaderSource = (options: Options) => {
  const parts: string[] = []
  parts.push(`${VersionHeader()}
	${PrecisionHeader()}
out vec4 finalColor;
in vec2 v_position;
uniform float u_values[${options.samplesCount * 2 + 1}];
uniform float u_targetMs;
uniform float u_heightScale;

void main() {
int index = int(v_position.x * ${options.samplesCount.toFixed(1)});
int trueIndex = 1 + index * 2 + (index >= ${options.samplesCount} ? -${options.samplesCount * 2} : 0);
float myValue = u_values[trueIndex];
float elapsedTime = u_values[trueIndex + 1];

if (abs(v_position.y - u_targetMs) < 0.003 * u_heightScale)
    finalColor = vec4(1.0, 0.0, 0.0, 1.0);
else if (v_position.y > myValue) {
  if (abs(v_position.y - elapsedTime) > 0.002 * u_heightScale) 
    discard;
  else
    finalColor = vec4(1.0, 1.0, 1.0, 0.6);
} else if (myValue > u_targetMs * 0.95) 
    finalColor = vec4(1.0, 0.3, 0.4, 0.9);
else if (myValue > u_targetMs * 0.5) 
    finalColor = vec4(0.9, 0.6, 0.3, 0.9);
else
    finalColor = vec4(0.1, 0.8, 0.4, 0.9);
}
	`)

  return parts.join('')
}

export type Uniforms = 'values[0]' | 'heightScale' | 'targetMs'
export type Attributes = 'dummyZero'
