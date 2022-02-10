import { MainRenderer } from './3d-stuff/main-renderer'
import { PrecisionHeader, VersionHeader } from './3d-stuff/shader/common'

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const renderer = MainRenderer.fromHTMLCanvas(canvas)
const program1 = (() => {
	const vertex = renderer.createShader(true, `${VersionHeader()}
${PrecisionHeader()}
in vec2 a_position;
in vec3 a_color;
in float a_size;
out vec3 v_color;
uniform float u_time;
void main() {
	v_color = a_color;
	gl_PointSize = a_size;
    gl_Position = vec4(a_position.x + float(gl_InstanceID) * 0.1, a_position.y + sin(u_time) * 0.1, 0, 1);
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
	type Attributes = 'position' | 'color' | 'size'
	const program = renderer.createProgram<Uniforms, Attributes>(vertex, fragment)
	const vao = renderer.createVAO()
	vao.bind()

	const positions = renderer.createBuffer(true, false)
	positions.setContent(new Float32Array([
		-0.8, -0.5,
		0.1, 0.3,
		0.4, -0.3,
	]))
	program.enableAttribute(program.attributes.position, 2, 0, 0, 0)


	const colors = renderer.createBuffer(true, false)
	colors.setContent(new Float32Array([
		1, 0, 0,
		0, 1, 0,
		0, 0, 1,
	]))
	program.enableAttribute(program.attributes.color, 3, 0, 0, 2)

	const sizes = renderer.createBuffer(true, false)
	sizes.setContent(new Float32Array([
		10, 30, 50, 40, 20, 100,
	]))
	program.enableAttribute(program.attributes.size, 1, 0, 0, 1)

	return {program, vao}
})()

const firstRenderTime = Date.now()
renderer.renderFunction = (gl) => {
	const now = Date.now()

	program1.vao.bind()
	program1.program.use()
	gl.uniform1f(program1.program.uniforms.time, (now - firstRenderTime) / 1000)
	gl.drawArraysInstanced(gl.POINTS, 0, 3, 5)
	// renderer.stopRendering()
}
renderer.beforeRenderFunction = (secondsSinceLastFrame) => secondsSinceLastFrame > 0.25 || document.hasFocus()
renderer.beginRendering()

