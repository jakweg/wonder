import { MainRenderer } from './3d-stuff/main-renderer'
import { PrecisionHeader, VersionHeader } from './3d-stuff/shader/common'
import { Camera } from './camera'
import KEYBOARD from './keyboard-controller'
import { generateMeshData, generateWorld } from './terrain-builder'
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
in vec3 a_normal;
flat out vec3 v_color;
flat out vec3 v_normal;
flat out vec3 v_currentPosition;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
void main() {
	v_color = a_color;
	v_normal = a_normal;
	v_currentPosition = a_position;
	vec3 pos = a_position;
	if (v_color == vec3(0.21875, 0.4921875, 0.9140625) || v_color == vec3(0.21875, 0.3421875, 0.8140625)){
		pos.y += sin(u_time + pos.x + pos.z * 100.0) * 0.5;
		pos.z += sin(u_time * 1.4 + pos.x + pos.z * 30.0) * 0.2;
		pos.x += cos(u_time + pos.x + pos.z * 100.0) * 0.3;
	}
    gl_Position = u_projection * u_view * vec4(pos, 1);
    gl_PointSize = 10.0;
}
`)
	const fragment = renderer.createShader(false, `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
flat in vec3 v_normal;
flat in vec3 v_color;
flat in vec3 v_currentPosition;
uniform float u_time;
uniform vec3 u_lightPosition;
void main() {
	vec3 lightDirection = normalize(u_lightPosition - v_currentPosition);
	float diffuse = max(dot(v_normal, lightDirection), 0.3);
	vec3 lightColor = mix(vec3(1,1,0.8), vec3(1,0.57,0.3), sin(u_time * 0.3) * 0.5 + 0.5);
	finalColor = vec4(v_color * lightColor * diffuse, 1);
}
`)

	type Uniforms = 'time' | 'projection' | 'view' | 'lightPosition'
	type Attributes = 'position' | 'color' | 'normal'
	const program = renderer.createProgram<Uniforms, Attributes>(vertex, fragment)
	const vao = renderer.createVAO()
	vao.bind()

	const a = performance.now()
	const size = {sizeX: 500, sizeY: 30, sizeZ: 500}
	const {elements, vertexes} = generateMeshData(generateWorld(size), size)
	const numbers = new Float32Array(vertexes)
	const uint32Array = new Uint32Array(elements)
	const elapsed = performance.now() - a
	console.log({elapsed})
	const positions = renderer.createBuffer(true, false)
	positions.setContent(numbers)
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const stride = 9 * floatSize
	program.enableAttribute(program.attributes.position, 3, stride, 0, 0)
	program.enableAttribute(program.attributes.color, 3, stride, 3 * floatSize, 0)
	program.enableAttribute(program.attributes.normal, 3, stride, 6 * floatSize, 0)

	const elementsBuffer = renderer.createBuffer(false, false)
	elementsBuffer.setContent(uint32Array)

	return {program, vao, trianglesToRender: elements.length / 3}
})()

const camera = Camera.newPerspective(90, 1280 / 720)
camera.moveCamera(15, 50, 55)

const lightPosition = vec3.fromValues(0, 50, 0)

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
	const secondsSinceRender = (now - firstRenderTime) / 1000
	gl.uniform1f(program.uniforms.time, secondsSinceRender)
	const r = 100
	lightPosition[0] = Math.cos(secondsSinceRender / 2) * r + 250
	lightPosition[1] = Math.sin(secondsSinceRender / 2) * 10 + 120
	lightPosition[2] = Math.sin(secondsSinceRender / 2) * r + 250
	gl.uniform3fv(program.uniforms.lightPosition, toGl(lightPosition))
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
