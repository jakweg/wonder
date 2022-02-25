import { toGl } from '../../../util/matrix/common'
import * as mat4 from '../../../util/matrix/mat4'
import { GPUBuffer, MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { World } from '../../world/world'
import { convertWorldToMesh } from '../../world/world-to-mesh-converter'
import { RenderContext } from '../render-context'
import {
	Attributes,
	fragmentShaderSource,
	MousePickerAttributes,
	MousePickerUniforms,
	pickViaMouseFragmentShader,
	pickViaMouseVertexShaderSource,
	Uniforms,
	vertexShaderSource,
} from './terrain-shaders'

const MOUSE_PICKER_RESOLUTION_DIVISOR = 6

function setUpMousePicker(renderer: MainRenderer, vertexBuffer: GPUBuffer, indicesBuffer: GPUBuffer) {
	const gl = renderer.rawContext
	const mouseProgram = createProgramFromNewShaders<MousePickerAttributes, MousePickerUniforms>(renderer, pickViaMouseVertexShaderSource, pickViaMouseFragmentShader)
	const mouseVao = renderer.createVAO()
	mouseVao.bind()
	vertexBuffer.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	mouseProgram.enableAttribute(mouseProgram.attributes.position, 3, true, 7 * floatSize, 0, 0)
	mouseProgram.enableAttribute(mouseProgram.attributes.flags, 1, true, 7 * floatSize, 6 * floatSize, 0)
	indicesBuffer.bind()

	const fb = gl.createFramebuffer()
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb)

	const texture1 = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, texture1)

	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
		1280 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 720 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 0,
		gl.RGBA, gl.UNSIGNED_BYTE, null)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture1, 0)

	const texture2 = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, texture2)

	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB,
		1280 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 720 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 0,
		gl.RGB, gl.UNSIGNED_BYTE, null)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)


	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texture2, 0)
	gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
	if (status !== gl.FRAMEBUFFER_COMPLETE) {
		console.error('invalid framebuffer status', status)
	}
	gl.bindFramebuffer(gl.FRAMEBUFFER, null)
	return {mouseProgram, mouseVao, fb}
}

function setUpStandardRenderer(renderer: MainRenderer) {
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)
	const vao = renderer.createVAO()
	vao.bind()
	const vertexBuffer = renderer.createBuffer(true, false)
	vertexBuffer.bind()
	const indicesBuffer = renderer.createBuffer(false, false)
	indicesBuffer.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const stride = 7 * floatSize

	program.enableAttribute(program.attributes.position, 3, true, stride, 0, 0)
	program.enableAttribute(program.attributes.color, 3, true, stride, 3 * floatSize, 0)
	program.enableAttribute(program.attributes.flags, 1, true, stride, 6 * floatSize, 0)
	return {program, vao, vertexBuffer, indicesBuffer}
}

export const createNewTerrainRenderable = (renderer: MainRenderer,
                                           world: World) => {

	const {program, vao, vertexBuffer, indicesBuffer} = setUpStandardRenderer(renderer)
	const {mouseProgram, mouseVao, fb} = setUpMousePicker(renderer, vertexBuffer, indicesBuffer)


	let trianglesToRender = 0 | 0
	let needsMeshRefresh = true
	const refreshMesh = () => {
		vao.bind()
		const mesh = convertWorldToMesh(world)
		vertexBuffer.setContent(mesh.vertexes)
		indicesBuffer.setContent(mesh.indices)
		trianglesToRender = (mesh.indices.byteLength / mesh.indices.BYTES_PER_ELEMENT) | 0
		needsMeshRefresh = false
	}

	return {
		requestRebuildMesh() {
			needsMeshRefresh = true
		},
		render(ctx: RenderContext) {
			if (needsMeshRefresh) refreshMesh()
			const {gl, camera} = ctx
			vao.bind()
			program.use()

			gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(ctx.sunPosition))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
		},

		getBlockByMouseCoords(ctx: RenderContext, mouseX: number, mouseY: number): { x: number, y: number, z: number, normals: [number, number, number] } | null {
			if (needsMeshRefresh) refreshMesh()
			const {gl, camera} = ctx
			gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
			gl.viewport(0, 0, 1280 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 720 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0)
			gl.clearColor(0, 0, 0, 0)
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
			mouseVao.bind()
			mouseProgram.use()

			gl.uniformMatrix4fv(mouseProgram.uniforms.globalMatrix, false, toGl(mat4.multiply(mat4.create(), camera.perspectiveMatrix, camera.viewMatrix)))
			gl.uniform1f(mouseProgram.uniforms.time, ctx.secondsSinceFirstRender)

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
			const readPixelsBuffer = new Uint8Array(7)
			gl.readBuffer(gl.COLOR_ATTACHMENT0)
			const pixelX = mouseX / MOUSE_PICKER_RESOLUTION_DIVISOR | 0
			const pixelY = mouseY / MOUSE_PICKER_RESOLUTION_DIVISOR | 0
			gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelsBuffer, 0)
			gl.readBuffer(gl.COLOR_ATTACHMENT1)
			gl.readPixels(pixelX, pixelY, 1, 1, gl.RGB, gl.UNSIGNED_BYTE, readPixelsBuffer, 4)
			gl.bindFramebuffer(gl.FRAMEBUFFER, null)

			if (readPixelsBuffer[1]! === 0 && readPixelsBuffer[3]! === 0 && readPixelsBuffer[5]! === 0) {
				// hit nothing
				return null
			}
			const x = readPixelsBuffer[0]! << 8 | readPixelsBuffer[1]!
			const z = readPixelsBuffer[2]! << 8 | readPixelsBuffer[3]!
			const y = readPixelsBuffer[4]! << 8 | readPixelsBuffer[5]!

			const normals = readPixelsBuffer[6]! & 0b111111
			const nx = ((normals >> 4) & 0b11) - 1
			const ny = ((normals >> 2) & 0b11) - 1
			const nz = ((normals >> 0) & 0b11) - 1
			return {x, y, z, normals: [nx, ny, nz]}
		},
	}
}
