import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { RenderContext } from '../render-context'
import { buildBoxModel } from './item-model'
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './item-shaders'

export const createNewItemRenderable = (renderer: MainRenderer) => {
	const itemPositions = [
		// position: x,y,z
		8, 2, 4,
	]

	const mesh = buildBoxModel()
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)

	const modelBuffer = renderer.createBuffer(true, false)
	modelBuffer.setContent(mesh.vertexes)
	program.enableAttribute(program.attributes.modelPosition, 3, true, 4 * floatSize, 0, 0)
	program.enableAttribute(program.attributes.flags, 1, true, 4 * floatSize, 3 * floatSize, 0)


	const unitDataBuffer = renderer.createBuffer(true, false)
	unitDataBuffer.setContent(new Float32Array(itemPositions))
	program.enableAttribute(program.attributes.worldPosition, 3, true, 0, 0, 1)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	modelElementsBuffer.setContent(mesh.elements)

	const trianglesToRender = mesh.trianglesToRender
	const instancesCount = itemPositions.length / 3 | 0
	return {
		render(ctx: RenderContext) {
			const {gl, camera} = ctx
			vao.bind()
			program.use()
			modelBuffer.bind()

			gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

			gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_BYTE, 0, instancesCount)
		},
	}
}
