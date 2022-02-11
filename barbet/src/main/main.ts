import { MainRenderer } from './3d-stuff/main-renderer'
import { PrecisionHeader, VersionHeader } from './3d-stuff/shader/common'
import { Camera } from './camera'
import KEYBOARD from './keyboard-controller'
import { buildVertexData } from './terrain-builder'
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
flat out vec3 v_color;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
void main() {
	v_color = a_color;
	// if (a_position.x > 9.0 && a_position.z > 9.0)
	// 	v_color = vec3(0,0,0);
	// v_color = vec3(gl_VertexID % 3 == 0 ? 1 : 0, gl_VertexID % 3 == 1 ? 1 : 0, gl_VertexID % 3 == 2 ? 1 : 0);
    gl_Position = u_projection * u_view * vec4(a_position.x, a_position.y, a_position.z, 1);
    // gl_Position = vec4(x, 0, z, 1);
    // gl_Position = vec4(0,0,0,0);
    gl_PointSize = 10.0;
}
`)
	const fragment = renderer.createShader(false, `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
flat in vec3 v_color;
uniform float u_time;
void main() {
	if (gl_FrontFacing)
	finalColor = vec4(v_color, 1);
	else
	finalColor = vec4(1, sin(u_time * 5.0) / 2.0 + 0.5, 0, 1);
}
`)

	type Uniforms = 'time' | 'projection' | 'view'
	type Attributes = 'position' | 'color'
	const program = renderer.createProgram<Uniforms, Attributes>(vertex, fragment)
	const vao = renderer.createVAO()
	vao.bind()

	const sizeX = 100
	const sizeY = 100
	const {elements, vertexes} = buildVertexData(sizeX, sizeY)
	const positions = renderer.createBuffer(true, false)
	positions.setContent(new Float32Array(vertexes.flat()))
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	program.enableAttribute(program.attributes.position, 3, 6 * floatSize, 0, 0)
	program.enableAttribute(program.attributes.color, 3, 6 * floatSize, 3 * floatSize, 0)


	const elementsBuffer = renderer.createBuffer(false, false)
	elementsBuffer.setContent(new Uint32Array(elements))

	return {program, vao, trianglesToRender: elements.length / 3}
})()

const camera = Camera.newPerspective(90, 1280 / 720)

const firstRenderTime = Date.now()
renderer.renderFunction = (gl, dt) => {
	const now = Date.now()

	moveCameraByKeys(camera, dt)
	camera.lastEyeChangeId++
	camera.updateMatrixIfNeeded()
	// mat4.rotateY(camera.viewMatrix, camera.viewMatrix, -3 * Math.PI / 4)
	const {vao, program, trianglesToRender} = program1
	vao.bind()
	program.use()
	gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
	gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
	gl.uniform1f(program.uniforms.time, (now - firstRenderTime) / 1000)
	// gl.drawArraysInstanced(gl.TRIANGLES, 0, triangles * 3, 1)
	gl.drawElements(gl.TRIANGLES, 3 * trianglesToRender, gl.UNSIGNED_INT, 0)
	// gl.drawArrays(gl.LINE_STRIP, 0,3 * trianglesToRender)
	// renderer.stopRendering()
}
renderer.beforeRenderFunction = (secondsSinceLastFrame) => secondsSinceLastFrame > 0.5 || document.hasFocus()
renderer.beginRendering()

const moveCameraByKeys = (camera: Camera, dt: number) => {
	if (!KEYBOARD.isAnyPressed()) return
	const speed = dt * 3 * camera.eye[1]
	const speedVerticalSpeed = speed / camera.eye[1]

	const front1 = vec3.subtract(vec3.create(), camera.center, camera.eye)
	vec3.normalize(front1, front1)
	if (KEYBOARD.isPressed('KeyW') || KEYBOARD.isPressed('ArrowUp')) {
		camera.moveCamera(speed, 0, 0)
	}
	if (KEYBOARD.isPressed('KeyS') || KEYBOARD.isPressed('ArrowDown')) {
		camera.moveCamera(-speed, 0, 0)
	}
	if (KEYBOARD.isPressed('KeyA') || KEYBOARD.isPressed('ArrowLeft')) {
		camera.moveCamera(0, 0, -speed)
	}
	if (KEYBOARD.isPressed('KeyD') || KEYBOARD.isPressed('ArrowRight')) {
		camera.moveCamera(0, 0, speed)
	}
	if (KEYBOARD.isPressed('ShiftLeft')) {
		camera.moveCamera(0, -speed, 0)
	}
	if (KEYBOARD.isPressed('Space')) {
		camera.moveCamera(0, speed, 0)
	}

	camera.lastEyeChangeId++
}
