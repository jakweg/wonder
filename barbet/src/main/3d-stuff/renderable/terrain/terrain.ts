import { toGl } from '../../../util/matrix/common'
import { observeSetting } from '../../../worker/observable-settings'
import { GPUBuffer, MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders, pickViaMouseDefaultFragmentShader } from '../../shader/common'
import { World, WORLD_CHUNK_SIZE } from '../../world/world'
import { buildChunkMesh, combineMeshes, Mesh } from '../../world/world-to-mesh-converter'
import { RenderContext } from '../render-context'
import {
	Attributes,
	fragmentShaderSource,
	fragmentShaderSourceWithTileBorders,
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
	mouseProgram.enableAttribute(mouseProgram.attributes['position'], 3, true, 7 * floatSize, 0, 0)
	mouseProgram.enableAttribute(mouseProgram.attributes['flags'], 1, true, 7 * floatSize, 6 * floatSize, 0)
	indicesBuffer.bind()

	return {mouseProgram, mouseVao}
}

function setUpStandardRenderer(renderer: MainRenderer) {
	const defaultProgram = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)
	const programWithTileBorders = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSourceWithTileBorders)
	const vao = renderer.createVAO()
	vao.bind()
	const vertexBuffer = renderer.createBuffer(true, false)
	vertexBuffer.bind()
	const indicesBuffer = renderer.createBuffer(false, false)
	indicesBuffer.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const stride = 7 * floatSize

	for (const program of [defaultProgram, programWithTileBorders]) {
		program.enableAttribute(program.attributes['position'], 3, true, stride, 0, 0)
		program.enableAttribute(program.attributes['color'], 3, true, stride, 3 * floatSize, 0)
		program.enableAttribute(program.attributes['flags'], 1, true, stride, 6 * floatSize, 0)
	}
	return {defaultProgram, programWithTileBorders, vao, vertexBuffer, indicesBuffer}
}

export const createNewTerrainRenderable = (renderer: MainRenderer,
                                           world: World) => {

	const {defaultProgram, programWithTileBorders, vao, vertexBuffer, indicesBuffer} = setUpStandardRenderer(renderer)
	const {mouseProgram, mouseVao} = setUpMousePicker(renderer, vertexBuffer, indicesBuffer)


	let trianglesToRender = 0 | 0
	let lastMeshRecreationId = -1
	const chunksX = world.size.chunksSizeX
	const chunksZ = world.size.chunksSizeZ
	const meshes: Mesh[] = new Array(chunksX * chunksZ)
	const lastMeshModificationIds: Uint16Array = new Uint16Array(chunksX * chunksZ)
	lastMeshModificationIds.fill(-1)

	const rebuildMeshIfNeeded = () => {
		let counter = 0
		renderer.unbindVAO()
		if (lastMeshRecreationId === world.lastChangeId) return
		let chunkIndex = 0
		for (let j = 0; j < chunksZ; j++) {
			for (let i = 0; i < chunksX; i++) {
				const modificationId = world.chunkModificationIds[chunkIndex]!
				if (lastMeshModificationIds[chunkIndex] !== modificationId) {
					lastMeshModificationIds[chunkIndex] = modificationId
					meshes[chunkIndex] = buildChunkMesh(world, i, j, WORLD_CHUNK_SIZE)
					counter++
				}
				chunkIndex++
			}
		}

		const combinedMesh: Mesh = combineMeshes(meshes)
		vertexBuffer.setContent(combinedMesh.vertexes)
		indicesBuffer.setContent(combinedMesh.indices)
		trianglesToRender = (combinedMesh.indices.byteLength / combinedMesh.indices.BYTES_PER_ELEMENT) | 0
		lastMeshRecreationId = world.lastChangeId
	}

	let showTileBorders = false
	observeSetting('rendering/show-tile-borders', v => showTileBorders = v)

	return {
		render(ctx: RenderContext) {
			rebuildMeshIfNeeded()
			const {gl, camera} = ctx
			vao.bind()
			const program = showTileBorders ? programWithTileBorders : defaultProgram;
			program.use()

			gl.uniformMatrix4fv(program.uniforms['projection'], false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms['view'], false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms['lightPosition'], toGl(ctx.sunPosition))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
		},
		renderForMousePicker(ctx: RenderContext) {
			rebuildMeshIfNeeded()
			const {gl, camera: {combinedMatrix}} = ctx

			mouseVao.bind()
			mouseProgram.use()

			gl.uniformMatrix4fv(mouseProgram.uniforms['combinedMatrix'], false, toGl(combinedMatrix))
			gl.uniform1f(mouseProgram.uniforms['time'], ctx.secondsSinceFirstRender)

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
		},
	}
}
