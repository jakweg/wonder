import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { RenderContext } from '../render-context'
import { buildUnitModel } from './unit-model'
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './unit-shaders'

export const createNewUnitRenderable = (renderer: MainRenderer) => {
	const unitData = [
		// position: x,y,z ; primary color: r,g,b, secondary color: r,g,b, face color: r,g,b
		6, 2, 14, 1, 0.6171875, 0.00390625, 0.62890625, 0.99609375, 0.40625, 0.1171875, 0.4375, 0,
		8, 2, 5, 0, 0.37890625, 0.53515625, 0, 0.58984375, 0.63671875, 0.83203125, 0.984375, 0.99609375,
		10, 2, 9, 0.984375, 0.703125, 0.140625, 0.9921875, 0.99609375, 0.78125, 0.3984375, 0.234375, 0.0546875,
	]

	const mesh = buildUnitModel()
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)

	const modelBuffer = renderer.createBuffer(true, false)
	modelBuffer.setContent(mesh.vertexes)
	program.enableAttribute(program.attributes.modelPosition, 3, true, 7 * floatSize, 0, 0)
	program.enableAttribute(program.attributes.flags, 1, true, 7 * floatSize, 6 * floatSize, 0)


	const unitDataBuffer = renderer.createBuffer(true, false)
	unitDataBuffer.setContent(new Float32Array(unitData))
	program.enableAttribute(program.attributes.worldPosition, 3, true, 12 * floatSize, 0, 1)
	program.enableAttribute(program.attributes.primaryColor, 3, true, 12 * floatSize, 3 * floatSize, 1)
	program.enableAttribute(program.attributes.secondaryColor, 3, true, 12 * floatSize, 6 * floatSize, 1)
	program.enableAttribute(program.attributes.faceColor, 3, true, 12 * floatSize, 9 * floatSize, 1)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	modelElementsBuffer.setContent(mesh.elements)

	const trianglesToRender = mesh.trianglesToRender
	const instancesCount = unitData.length / 12 | 0
	return {
		render(ctx: RenderContext) {
			const {gl, camera} = ctx
			vao.bind()
			program.use()
			modelBuffer.bind()

			gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -10, -400))))

			gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0, instancesCount)
		},
	}
}
