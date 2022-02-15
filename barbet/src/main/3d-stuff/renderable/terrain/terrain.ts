import { toGl } from '../../../util/matrix/common'
import { MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { World } from '../../world/world'
import { convertWorldToMesh } from '../../world/world-to-mesh-converter'
import { Renderable, RenderContext } from '../render-context'
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './terrain-shaders'

export const createNewTerrainRenderable = (renderer: MainRenderer,
                                           world: World): Renderable => {
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)
	const vao = renderer.createVAO()
	vao.bind()

	const mesh = convertWorldToMesh(world)

	const vertexBuffer = renderer.createBuffer(true, false)
	vertexBuffer.setContent(mesh.vertexes)

	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const stride = 7 * floatSize

	program.enableAttribute(program.attributes.position, 3, true, stride, 0, 0)
	program.enableAttribute(program.attributes.color, 3, true, stride, 3 * floatSize, 0)
	program.enableAttribute(program.attributes.flags, 1, true, stride, 6 * floatSize, 0)


	const indicesBuffer = renderer.createBuffer(false, false)
	indicesBuffer.setContent(mesh.indices)

	const trianglesToRender = (mesh.indices.byteLength / mesh.indices.BYTES_PER_ELEMENT) | 0
	return {
		render(ctx: RenderContext) {
			const {gl, camera} = ctx
			vao.bind()
			program.use()

			gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(ctx.sunPosition))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
		},
	}
}
