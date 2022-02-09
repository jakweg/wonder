import { toGl, toRadian } from './util/matrix/common'
import * as mat4 from './util/matrix/mat4'
import * as vec3 from './util/matrix/vec3'

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const gl = canvas.getContext('webgl2', {
	alpha: false,
	antialias: false,
	depth: true,
	stencil: false,
}) as WebGL2RenderingContext

function createShader(vertex: boolean, source: string): WebGLShader {
	const shader = gl.createShader(vertex ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER)!
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader))
		throw new Error('Shader compilation failed')
	}
	return shader
}

const renderTriangle = () => {
	const vertexShader = createShader(true, `#version 300 es
precision mediump float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_color;
uniform float u_time;
uniform mat4 u_transform;
uniform mat4 u_projection;
uniform mat4 u_view;
out vec3 color;
void main() {
	vec4 model = vec4(a_position, 1.0);
    model.z += sin(u_time * 1.0);
    gl_Position = u_projection * u_view * u_transform * model;
	color = a_color;
}
`)
	const fragmentShader = createShader(false, `#version 300 es
precision mediump float;
in vec3 color;
out vec4 finalColor;
uniform float u_mouseX;
uniform float u_mouseY;
void main() {
	finalColor = vec4(color, 1);
	float d = distance(vec2(gl_FragCoord.x / 1280.0, gl_FragCoord.y / 720.0), vec2(u_mouseX, -u_mouseY + 1.0));
	if (d < 0.08) {
	finalColor = mix(finalColor, vec4(1, 1, 1, 1), 1.0 - d * (1.0 / 0.08));
	}
}
`)

	const program = gl.createProgram()!
	gl.attachShader(program, vertexShader)
	gl.attachShader(program, fragmentShader)
	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program)
		console.error(info)
		throw new Error('Program link failed')
	}

	const vertexArray = gl.createVertexArray()
	gl.bindVertexArray(vertexArray)

	const positionsBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		-1, -1, 0,
		1, -1, 0,
		0, 1, 0,
	]), gl.DYNAMIC_DRAW)
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
	gl.enableVertexAttribArray(0)

	const colorsBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		1, 0, 0,
		0, 1, 0,
		0, 0, 1,
	]), gl.DYNAMIC_DRAW)
	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
	gl.enableVertexAttribArray(1)

	const uniformLocationTime = gl.getUniformLocation(program, 'u_time')
	const uniformLocationMouseX = gl.getUniformLocation(program, 'u_mouseX')
	const uniformLocationMouseY = gl.getUniformLocation(program, 'u_mouseY')
	const uniformLocationTransform = gl.getUniformLocation(program, 'u_transform')
	const uniformLocationProjection = gl.getUniformLocation(program, 'u_projection')
	const uniformLocationView = gl.getUniformLocation(program, 'u_view')

	gl.useProgram(program)
	const transform = mat4.create()
	mat4.identity(transform)
	gl.uniformMatrix4fv(uniformLocationTransform, false, toGl(transform))


	const projection = mat4.perspective(mat4.create(), toRadian(50), 1280 / 720, 1 / 256, 256)
	gl.uniformMatrix4fv(uniformLocationProjection, false, toGl(projection))

	let mouseX = 0
	let mouseY = 0
	canvas.addEventListener('mousemove', (event) => {
		mouseX = event.clientX / 1280
		mouseY = event.clientY / 720
	})

	const renderStart = Date.now() - 1
	const render = () => {
		if (document.hasFocus() || true) {
			const nowInRenderTimeSeconds = (Date.now() - renderStart) * 0.001

			const view = mat4.create()
			mat4.lookAt(view, vec3.fromValues(2, 2, 3), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 1))
			gl.uniformMatrix4fv(uniformLocationView, false, toGl(view))

			mat4.identity(transform)
			mat4.translate(transform, transform, vec3.fromValues(0, -Math.sin(nowInRenderTimeSeconds) - 0.5, 0))
			mat4.rotateZ(transform, transform, nowInRenderTimeSeconds)
			gl.uniformMatrix4fv(uniformLocationTransform, false, toGl(transform))

			gl.uniform1f(uniformLocationTime, nowInRenderTimeSeconds)
			gl.uniform1f(uniformLocationMouseX, mouseX)
			gl.uniform1f(uniformLocationMouseY, mouseY)
			gl.clearColor(0.1, 0.1, 0.1, 1)
			gl.clear(gl.COLOR_BUFFER_BIT)
			gl.viewport(0, 0, 1280, 720)
			gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1)
		}
		requestAnimationFrame(render)
	}
	render()
}

renderTriangle()
