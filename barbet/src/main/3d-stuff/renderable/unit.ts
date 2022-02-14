import { toGl } from '../../util/matrix/common'
import { add, clone, fromValues } from '../../util/matrix/vec3'
import { MainRenderer } from '../main-renderer'
import { createProgramFromNewShaders } from '../shader/common'
import { RenderContext } from './render-context'
import { Attributes, FLAG_BOTTOM, FLAG_TOP, fragmentShaderSource, Uniforms, vertexShaderSource } from './unit-shaders'

export const createNewUnitRenderable = (renderer: MainRenderer) => {
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)

	const modelBuffer = renderer.createBuffer(true, false)
	modelBuffer.setContent(new Float32Array([
		// main body:
		-0.5, 0, -0.5, 1, 1, 0, FLAG_BOTTOM | 0b010001, // bottom
		0.5, 0, -0.5, 0, 1, 0, FLAG_BOTTOM | 0b010100, // bottom front
		0.5, 0, 0.5, 1, 1, 0, FLAG_BOTTOM | 0b100101, // bottom right side
		-0.5, 0, 0.5, 1, 1, 1, FLAG_BOTTOM,

		-0.5, 1, -0.5, 1, 1, 1, FLAG_TOP,
		0.5, 1, -0.5, 1, 0, 1, FLAG_TOP | 0b010100, // top front
		0.5, 1, 0.5, 1, 1, 0, FLAG_BOTTOM | 0b010110,// bottom back
		-0.5, 1, 0.5, 1, 1, 0, FLAG_BOTTOM | 0b000101,// bottom left side

		-0.5, 2, -0.5, 0, 1, 1, FLAG_TOP | 0b011001,// top
		0.5, 2, -0.5, 1, 1, 1, FLAG_TOP | 0b100101,// top right side
		0.5, 2, 0.5, 1, 1, 1, FLAG_TOP | 0b010110,// top back
		-0.5, 2, 0.5, 1, 1, 1, FLAG_TOP | 0b000101,// top left side
	]))
	program.enableAttribute(program.attributes.modelPosition, 3, true, 7 * floatSize, 0, 0)
	program.enableAttribute(program.attributes.flags, 1, true, 7 * floatSize, 6 * floatSize, 0)


	const colorsBuffer = renderer.createBuffer(true, false)
	colorsBuffer.setContent(new Float32Array([
		0, 0.6171875, 0.00390625, 0.62890625, 0.99609375, 0.40625,
		0, 0.37890625, 0.53515625, 0, 0.58984375, 0.63671875,
	]))
	program.enableAttribute(program.attributes.primaryColor, 3, true, 6 * floatSize, 0, 1)
	program.enableAttribute(program.attributes.secondaryColor, 3, true, 6 * floatSize, 3 * floatSize, 1)


	const positionsBuffer = renderer.createBuffer(true, false)
	const positionsList = [
		6, 2, 14,
		8, 2, 5,
	]
	positionsBuffer.setContent(new Float32Array(positionsList))
	program.enableAttribute(program.attributes.worldPosition, 3, true, 3 * floatSize, 0, 1)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	const elementsData = new Uint8Array([
		// bottom
		1, 2, 0,
		2, 3, 0,
		// bottom front
		0, 4, 1,
		4, 5, 1,
		// bottom right side
		1, 5, 2,
		5, 6, 2,
		// bottom left side
		0, 3, 7,
		4, 0, 7,
		// bottom back
		3, 2, 6,
		7, 3, 6,

		// top front
		4, 8, 5,
		8, 9, 5,
		// top right side
		6, 5, 9,
		10, 6, 9,
		// top left side
		4, 7, 11,
		8, 4, 11,
		// top back
		7, 6, 10,
		11, 7, 10,

		// top
		10, 9, 8,
		11, 10, 8,
	])
	modelElementsBuffer.setContent(elementsData)


	const trianglesToRender = elementsData.byteLength | 0
	const instancesCount = positionsList.length / 3 | 0
	console.assert(trianglesToRender < 255)
	return {
		render(ctx: RenderContext) {
			const {gl, camera} = ctx
			gl.disable(gl.CULL_FACE)
			vao.bind()
			program.use()
			modelBuffer.bind()

			gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

			gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender | 0, gl.UNSIGNED_BYTE, 0, instancesCount)
			gl.enable(gl.CULL_FACE)
		},
	}
}
