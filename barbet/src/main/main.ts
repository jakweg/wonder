import {
	createBuffer,
	createProgram,
	createShader,
	newGlResourcesContext,
	PrecisionHeader,
	setBufferContent,
	VersionHeader,
} from './shader/common'

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const gl = canvas.getContext('webgl2', {
	alpha: false,
	antialias: false,
	depth: true,
	stencil: false,
}) as WebGL2RenderingContext

const ctx = newGlResourcesContext(canvas, gl)
const vertex = createShader(ctx, true, `${VersionHeader()}
${PrecisionHeader()}
in vec2 a_position;
in vec3 a_color;
in float a_invert;
uniform float u_time;
out vec3 v_color;
void main() {
	v_color = a_color;
	float xOffset = gl_VertexID == 2 ? sin(u_time) * 0.5 : 0.0;
	float yOffset = gl_VertexID == 2 ? sin(u_time * 10.0) * 0.1 : 0.0;
	if (a_invert > 0.0)
        gl_Position = vec4(a_position.x - xOffset, -a_position.y + yOffset, 0, 1);
    else
        gl_Position = vec4(a_position.x + xOffset, a_position.y + yOffset, 0, 1);
}
`)
const fragment = createShader(ctx, false, `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
in vec3 v_color;
void main() {
	finalColor = vec4(v_color, 1);
}
`)

type Uniforms = 'time' | 'transform' | 'projection' | 'view' | 'mouseX' | 'mouseY'
type Attributes = 'position' | 'color' | 'invert'
const program = createProgram<Uniforms, Attributes>(ctx, vertex, fragment)

const positions = createBuffer(ctx, gl.ARRAY_BUFFER, false)
setBufferContent(ctx, positions, new Float32Array([
	-1, -1,
	1, -1,
	0, 1,
]))
gl.vertexAttribPointer(program.attributes.position, 2, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(program.attributes.position, 0)


const colors = createBuffer(ctx, gl.ARRAY_BUFFER, false)
setBufferContent(ctx, colors, new Float32Array([
	1, 0, 0,
	0, 1, 0,
	0, 0, 1,
]))
gl.vertexAttribPointer(program.attributes.color, 3, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(program.attributes.color, 0)

const inverts = createBuffer(ctx, gl.ARRAY_BUFFER, false)
setBufferContent(ctx, inverts, new Float32Array([
	0, 1,
]))
gl.vertexAttribPointer(program.attributes.invert, 1, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(program.attributes.invert, 1)


gl.useProgram(program.program)


const fpsCap = 120
const minMillisBetweenFrames = 1000 / fpsCap
let lastFrameTime = 0
const firstRenderTime = Date.now()
const render = () => {
	const now = Date.now()
	if (now - lastFrameTime > minMillisBetweenFrames) {
		lastFrameTime = now

		gl.uniform1f(program.uniforms.time, (now - firstRenderTime) / 1000)


		gl.clearColor(0.1, 0.1, 0.1, 1)
		gl.clear(gl.COLOR_BUFFER_BIT)
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 2)
	}
	requestAnimationFrame(render)
}
requestAnimationFrame(render)
