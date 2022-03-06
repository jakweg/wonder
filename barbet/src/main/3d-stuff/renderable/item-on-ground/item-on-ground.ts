import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { ItemType, requireItem } from '../../world/item'
import { RenderContext } from '../render-context'
import { Attributes, itemFragmentShaderSource, onGroundVertexShader, Uniforms } from './item-on-ground-shaders'

function prepareRenderer(renderer: MainRenderer) {
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, onGroundVertexShader, itemFragmentShaderSource)

	const modelBuffer = renderer.createBuffer(true, false)
	modelBuffer.setContent(new Float32Array())
	program.enableAttribute(program.attributes.modelPosition, 3, true, 4 * floatSize, 0, 0)
	program.enableAttribute(program.attributes.flags, 1, true, 4 * floatSize, 3 * floatSize, 0)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	modelElementsBuffer.setContent(new Float32Array())
	return {vao, program, modelBuffer, modelElementsBuffer}
}

const createNewItemOnGroundRenderable = (renderer: MainRenderer,
                                         game: GameState) => {
	const {vao, program, modelBuffer, modelElementsBuffer} = prepareRenderer(renderer)

	let trianglesToRender = 0
	let lastGroundDataChangeId = -1
	const recreateMeshIfNeeded = () => {
		if (lastGroundDataChangeId !== game.groundItems.lastDataChangeId) {
			lastGroundDataChangeId = game.groundItems.lastDataChangeId
			renderer.unbindVAO()

			const vertexData: number[] = []
			const elementsData: number[] = []

			let fieldIndex = 1
			for (let z = 0, h = game.groundItems.sizeZ; z < h; z++) {
				for (let x = 0, w = game.groundItems.sizeX; x < w; x++) {
					const type = game.groundItems.rawItemData[fieldIndex++]! as ItemType
					if (type === ItemType.None) continue

					const item = requireItem(type)

					const y = game.world.getHighestBlockHeight(x, z) + 1

					item.appendToMesh(x, y, z, vertexData, elementsData)
				}
			}

			trianglesToRender = elementsData.length
			modelBuffer.setContent(new Float32Array(vertexData))
			modelElementsBuffer.setContent(new Uint16Array(elementsData))
		}
	}

	return {
		render(ctx: RenderContext) {
			recreateMeshIfNeeded()
			const {gl, camera} = ctx

			vao.bind()
			program.use()

			gl.uniformMatrix4fv(program.uniforms.combinedMatrix, false, toGl(camera.combinedMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0)
		},
	}
}

export default createNewItemOnGroundRenderable
