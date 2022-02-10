import { MainRenderer } from './main-renderer'
import { PrecisionHeader, VersionHeader } from './shader/common'

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const renderer = MainRenderer.fromHTMLCanvas(canvas)
const program2 = (() => {
	const vertex = renderer.createShader(true, `${VersionHeader()}
${PrecisionHeader()}
in vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0, 1);
}
`)
	const fragment = renderer.createShader(false, `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
void main() {
	finalColor = vec4(1, 0, 0, 1);
}
`)

	const program = renderer.createProgram<string, 'position'>(vertex, fragment)

	const vao = renderer.createVAO()
	vao.bind()

	const positions = renderer.createBuffer(true, false)
	positions.setContent(new Float32Array([
		-1, -1,
		1, -1,
		1, 1,
	]))
	program.enableAttribute(program.attributes.position, 2, 0, 0, 0)
	return {program, vao}
})()
const program1 = (() => {
	const vertex = renderer.createShader(true, `${VersionHeader()}
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
	const fragment = renderer.createShader(false, `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
in vec3 v_color;
void main() {
	finalColor = vec4(v_color, 1);
}
`)

	type Uniforms = 'time' | 'transform' | 'projection' | 'view'
	type Attributes = 'position' | 'color' | 'invert'
	const program = renderer.createProgram<Uniforms, Attributes>(vertex, fragment)
	const vao = renderer.createVAO()
	vao.bind()

	const positions = renderer.createBuffer(true, false)
	positions.setContent(new Float32Array([
		-1, -1,
		1, -1,
		0, 0.85,
	]))
	program.enableAttribute(program.attributes.position, 2, 0, 0, 0)


	const colors = renderer.createBuffer(true, false)
	colors.setContent(new Float32Array([
		1, 0, 0,
		0, 1, 0,
		0, 0, 1,
	]))
	program.enableAttribute(program.attributes.color, 3, 0, 0, 0)


	const inverts = renderer.createBuffer(true, false)
	inverts.setContent(new Float32Array([
		0, 1,
	]))
	program.enableAttribute(program.attributes.invert, 1, 0, 0, 1)
	return {program, vao}
})()

const firstRenderTime = Date.now()
renderer.beginRendering((gl, delta) => {
	const now = Date.now()

	program1.vao.bind()
	program1.program.use()
	gl.uniform1f(program1.program!.uniforms.time, (now - firstRenderTime) / 1000)
	gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 2)

	program2.vao.bind()
	program2.program.use()
	gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1)
})

