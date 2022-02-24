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

const MOUSE_PICKER_RESOLUTION_DIVISOR = 4

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

	const texture = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, texture)

	const internalformat = gl.RGBA
	const format = gl.RGBA
	const type = gl.UNSIGNED_BYTE

	gl.texImage2D(gl.TEXTURE_2D, 0, internalformat,
		1280 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 720 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 0,
		format, type, null)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

	const fb = gl.createFramebuffer()
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb)

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
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

		getBlockByMouseCoords(ctx: RenderContext, mouseX: number, mouseY: number): { x: number, z: number } | null {
			if (needsMeshRefresh) refreshMesh()
			const {gl, camera} = ctx
			gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
			gl.viewport(0, 0, 1280 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 720 / MOUSE_PICKER_RESOLUTION_DIVISOR | 0)
			gl.clearColor(0, 0, 0, 1)
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
			mouseVao.bind()
			mouseProgram.use()

			gl.uniformMatrix4fv(mouseProgram.uniforms.globalMatrix, false, toGl(mat4.multiply(mat4.create(), camera.perspectiveMatrix, camera.viewMatrix)))
			gl.uniform1f(mouseProgram.uniforms.time, ctx.secondsSinceFirstRender)

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
			const readPixelsBuffer = new Uint8Array(4)
			gl.readPixels(mouseX / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, mouseY / MOUSE_PICKER_RESOLUTION_DIVISOR | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelsBuffer, 0)
			gl.bindFramebuffer(gl.FRAMEBUFFER, null)

			const tmp = ((readPixelsBuffer[0]! << 24) | (readPixelsBuffer[1]! << 16) | (readPixelsBuffer[2]! << 8) | readPixelsBuffer[3]!) >>> 8
			if (tmp === 0) {
				// hit nothing
				return null
			}
			const x = (tmp >> 12) & 0b1111_1111_1111
			const z = tmp & 0b1111_1111_1111
			return {x, z}
		},
	}
}
