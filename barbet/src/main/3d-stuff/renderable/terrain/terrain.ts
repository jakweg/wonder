import { toGl } from '../../../util/matrix/common'
import { GPUBuffer, MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders, pickViaMouseDefaultFragmentShader } from '../../shader/common'
import { World } from '../../world/world'
import { convertWorldToMesh } from '../../world/world-to-mesh-converter'
import { RenderContext } from '../render-context'
import {
	Attributes,
	fragmentShaderSource,
	MousePickerAttributes,
	MousePickerUniforms,
	pickViaMouseVertexShaderSource,
	Uniforms,
	vertexShaderSource,
} from './terrain-shaders'

function setUpMousePicker(renderer: MainRenderer, vertexBuffer: GPUBuffer, indicesBuffer: GPUBuffer) {
	const mouseProgram = createProgramFromNewShaders<MousePickerAttributes, MousePickerUniforms>(renderer, pickViaMouseVertexShaderSource, pickViaMouseDefaultFragmentShader)
	const mouseVao = renderer.createVAO()
	mouseVao.bind()
	vertexBuffer.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	mouseProgram.enableAttribute(mouseProgram.attributes.position, 3, true, 7 * floatSize, 0, 0)
	mouseProgram.enableAttribute(mouseProgram.attributes.flags, 1, true, 7 * floatSize, 6 * floatSize, 0)
	indicesBuffer.bind()

	return {mouseProgram, mouseVao}
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
	const {mouseProgram, mouseVao} = setUpMousePicker(renderer, vertexBuffer, indicesBuffer)


	let trianglesToRender = 0 | 0
	let lastMeshRecreationId = -1
	const rebuildMeshIfNeeded = () => {
		vao.bind()
		const mesh = convertWorldToMesh(world)
		vertexBuffer.setContent(mesh.vertexes)
		indicesBuffer.setContent(mesh.indices)
		trianglesToRender = (mesh.indices.byteLength / mesh.indices.BYTES_PER_ELEMENT) | 0
		lastMeshRecreationId = world.lastChangeId
	}

	return {
		render(ctx: RenderContext) {
			rebuildMeshIfNeeded()
			const {gl, camera} = ctx
			vao.bind()
			program.use()

			gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(ctx.sunPosition))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
		},
		renderForMousePicker(ctx: RenderContext) {
			rebuildMeshIfNeeded()
			const {gl, camera: {combinedMatrix}} = ctx

			mouseVao.bind()
			mouseProgram.use()

			gl.uniformMatrix4fv(mouseProgram.uniforms.combinedMatrix, false, toGl(combinedMatrix))
			gl.uniform1f(mouseProgram.uniforms.time, ctx.secondsSinceFirstRender)

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
		},
	}
}
