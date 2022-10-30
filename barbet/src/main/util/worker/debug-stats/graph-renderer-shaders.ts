import { PrecisionHeader, VersionHeader } from "../../../3d-stuff/common-shader";

interface Options {
    samplesCount: number
}

const createPositions = (p1x: number, p2x: number): string => {
    const m1x = p1x.toFixed(5)
    const m1y = (-1).toFixed(5)
    const m2x = p2x.toFixed(5)
    const m2y = (1).toFixed(5)
    const width = 1 / Math.abs(p1x - p2x);

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
const createHeightVariables = (): string => {
    const MS_PER_SCREEN = 64
    return `
float heightScale = ${(MS_PER_SCREEN).toFixed(5)};
`
}

export const vertexShaderSource = (options: Options): string => {
    const parts: string[] = [];
    parts.push(`${VersionHeader()}
${PrecisionHeader()}

uniform float u_width;
in vec2 a_position;
out vec2 v_position;
uniform float u_values[${options.samplesCount + 1}];

${createPositions(-1, -.2)}
${createHeightVariables()}

void main() {
    vec2 screenPosition = positions[gl_VertexID];
    float shift = u_values[0] / ${options.samplesCount.toFixed(1)};
    float x = (screenPosition.x - left) * width;
    v_position = vec2(
        x + shift,
        (screenPosition.y / 2.0 + 0.5) * heightScale);

    gl_Position = vec4(screenPosition.xy, 0.0, 1.0);
    gl_PointSize = 10.0;
}
	`)
    return parts.join('')
}


export const fragmentShaderSource = (options: Options) => {
    const parts: string[] = [];
    parts.push(`${VersionHeader()}
	${PrecisionHeader()}
out vec4 finalColor;
in vec2 v_position;
uniform float u_values[${options.samplesCount + 1}];
const float targetMs = 16.6;

void main() {
int index = int(v_position.x * ${options.samplesCount.toFixed(1)});
float myValue = u_values[1 + index + (index > ${options.samplesCount} ? -${options.samplesCount} : 0)];

if (abs(v_position.y - targetMs) < 0.08) 
    finalColor = vec4(1.0, 0.0, 0.0, 1.0);
else if (v_position.y > myValue) 
    discard;
else
    finalColor = vec4(1.0, 0.3, 0.4, 0.9);
}
	`)

    return parts.join('')
}

export type Uniforms = 'values[0]' | 'width'
export type Attributes = 'position'
