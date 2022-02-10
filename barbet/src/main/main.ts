import { MainRenderer } from './3d-stuff/main-renderer'
import { PrecisionHeader, VersionHeader } from './3d-stuff/shader/common'
import { Camera, universalUpVector } from './camera'
import { toGl } from './util/matrix/common'
import * as vec3 from './util/matrix/vec3'

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const renderer = MainRenderer.fromHTMLCanvas(canvas)
const program1 = (() => {
	const vertex = renderer.createShader(true, `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_position;
in vec3 a_color;
out vec3 v_color;
uniform float u_time;
uniform mat4 u_projection;
uniform mat4 u_view;
void main() {
	v_color = a_color;
    gl_Position = u_projection * u_view * vec4(a_position, 1);
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

	type Uniforms = 'time' | 'projection' | 'view'
	type Attributes = 'position' | 'color'
	const program = renderer.createProgram<Uniforms, Attributes>(vertex, fragment)
	const vao = renderer.createVAO()
	vao.bind()

	const positions = renderer.createBuffer(true, false)
	positions.setContent(new Float32Array([
		0, 1, 0,
		-1, -1, 0,
		1, -1, 0,
	]))
	program.enableAttribute(program.attributes.position, 3, 0, 0, 0)


	const colors = renderer.createBuffer(true, false)
	colors.setContent(new Float32Array([
		1, 0, 0,
		0, 1, 0,
		0, 0, 1,
	]))
	program.enableAttribute(program.attributes.color, 3, 0, 0, 0)

	return {program, vao}
})()

const camera = Camera.newPerspective(90, 1280 / 720)
camera.center[0] = 3
camera.center[1] = 0
camera.center[2] = 0
camera.eye[0] = 3
camera.eye[1] = 0
camera.eye[2] = -2

const firstRenderTime = Date.now()
renderer.renderFunction = (gl, dt) => {
	const now = Date.now()

	moveCameraByKeys(camera, dt)
	// camera.center[0] = 3
	// camera.center[1] = 0
	// camera.center[2] = 0
	// camera.eye[0] = 3
	// camera.eye[1] = 0
	// camera.eye[2] = -2 + Math.sin(now * 0.0010)
	camera.lastEyeChangeId++
	camera.updateMatrixIfNeeded()
	const {vao, program} = program1
	vao.bind()
	program.use()
	gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
	gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
	gl.uniform1f(program.uniforms.time, (now - firstRenderTime) / 1000)
	gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1)
	// renderer.stopRendering()
}
renderer.beforeRenderFunction = (secondsSinceLastFrame) => secondsSinceLastFrame > 0.001 || document.hasFocus()
renderer.beginRendering()

const pressedKeys: { [key: string]: boolean } = {}
document.addEventListener('keydown', event => {
	const code = event.code
	pressedKeys[code] = true
})
document.addEventListener('keyup', event => {
	const code = event.code
	pressedKeys[code] = false
})
document.addEventListener('blur', event => {
	for (const code in pressedKeys) {
		pressedKeys[code] = false
	}
})
const moveCameraByKeys = (camera: Camera, dt: number) => {
	const speed = dt * 3
	const isPressed = (code: string): boolean => {
		return pressedKeys[code] ?? false
	}

	const front1 = vec3.subtract(vec3.create(), camera.center, camera.eye)
	vec3.normalize(front1, front1)
	const front2 = vec3.clone(front1)
	const toAdd = vec3.fromValues(0, 0, 0)
	if (isPressed('KeyW')) {
		vec3.scale(toAdd, front1, speed)
	}
	if (isPressed('KeyS')) {
		vec3.scale(toAdd, front1, -speed)
	}
	if (isPressed('KeyA')) {
		vec3.scale(toAdd, vec3.normalize(front2, vec3.cross(front2, front2, universalUpVector)), -speed)
	}
	if (isPressed('KeyD')) {
		vec3.scale(toAdd, vec3.normalize(front2, vec3.cross(front2, front2, universalUpVector)), speed)
	}

	vec3.add(camera.center, camera.center, toAdd)
	vec3.add(camera.eye, camera.eye, toAdd)


	camera.lastEyeChangeId++
}
