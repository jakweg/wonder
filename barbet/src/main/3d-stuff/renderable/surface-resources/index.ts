import { toGl } from '@matrix//common'
import { fromValues } from '@matrix//vec3'
import { GameState } from '../../../game-state/game-state'
import { getAppendToMeshFunction, SurfaceResourceType } from '../../../game-state/surface-resources'
import {
	AMOUNT_SHIFT_BITS,
	MASK_AMOUNT,
	MASK_RESOURCE_TYPE,
} from '../../../game-state/surface-resources/surface-resources-index'
import { createProgramFromNewShaders } from '../../common-shader'
import { MainRenderer } from '../../main-renderer'
import { RenderContext } from '../render-context'
import { Attributes, surfaceResourceFragmentShader, surfaceResourceVertexShader, Uniforms } from './shaders'

export const createNewSurfaceResourcesRenderable = (renderer: MainRenderer,
                                                    game: GameState) => {
	const resources = game.surfaceResources
	const world = game.world

	const vao = renderer.createVAO()
	vao.bind()
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, surfaceResourceVertexShader, surfaceResourceFragmentShader)
	const modelBuffer = renderer.createBuffer(true, false)
	modelBuffer.setContent(new Float32Array())

	const floatSize = Float32Array.BYTES_PER_ELEMENT
	program.enableAttribute(program.attributes['modelPosition'], 3, true, 6 * floatSize, 0, 0)
	program.enableAttribute(program.attributes['normal'], 3, true, 6 * floatSize, 3 * floatSize, 0)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	modelElementsBuffer.setContent(new Float32Array())

	let trianglesToRender = 0
	let lastMeshRebuildId = -1

	const rebuildMeshIfNeeded = () => {
		if (lastMeshRebuildId !== resources.lastDataChangeId) {
			lastMeshRebuildId = resources.lastDataChangeId
			renderer.unbindVAO()

			const vertexData: number[] = []
			const elementsData: number[] = []

			let fieldIndex = 1
			for (let z = 0, h = resources.sizeZ; z < h; z++) {
				for (let x = 0, w = resources.sizeX; x < w; x++) {
					const raw = resources.rawData[fieldIndex++]!
					const type = raw & MASK_RESOURCE_TYPE as SurfaceResourceType
					if (type === SurfaceResourceType.None) continue
					const amount = ((raw & MASK_AMOUNT) >> AMOUNT_SHIFT_BITS) + 1
					const appendToMesh = getAppendToMeshFunction(type)

					const y = world.getHighestBlockHeight(x, z) + 1

					appendToMesh(x, y, z, amount, vertexData, elementsData)
				}
			}

			trianglesToRender = elementsData.length
			modelBuffer.setContent(new Float32Array(vertexData))
			modelElementsBuffer.setContent(new Uint16Array(elementsData))
		}
	}

	return {
		render(ctx: RenderContext): void {
			rebuildMeshIfNeeded()

			const {gl} = ctx
			vao.bind()
			program.use()

			modelBuffer.bind()
			modelElementsBuffer.bind()

			gl.uniform3fv(program.uniforms['lightPosition'], toGl(fromValues(80, 40, 20)))
			gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(ctx.camera.combinedMatrix))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0)
		},
	}
}
