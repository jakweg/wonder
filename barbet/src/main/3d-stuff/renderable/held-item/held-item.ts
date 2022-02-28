import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { allItems, ItemType } from '../../world/item'
import { RenderContext } from '../render-context'
import { ActivityId } from '../unit/activity'
import { Attributes, inHandVertexShader, itemFragmentShaderSource, Uniforms, UnitData } from './held-item-shaders'

function prepareRenderer(renderer: MainRenderer) {
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, inHandVertexShader, itemFragmentShaderSource)

	program.enableAttribute(program.attributes.modelPosition, 3, true, 4 * floatSize, 0, 0)
	program.enableAttribute(program.attributes.flags, 1, true, 4 * floatSize, 3 * floatSize, 0)

	return {vao, program}
}

const createHeldItemRenderable = (renderer: MainRenderer,
                                  game: GameState) => {
	const {vao, program} = prepareRenderer(renderer)

	const itemBuffers = allItems.map(item => item.createMeshBuffer(renderer))
	for (const {array} of itemBuffers) {
		if (array == null) continue
		array.bind()
		program.enableAttribute(program.attributes.modelPosition, 3, true, 4 * 4, 0, 0)
		program.enableAttribute(program.attributes.flags, 1, true, 4 * 4, 3 * 4, 0)
	}

	return {
		render(ctx: RenderContext) {
			const {gl, camera} = ctx

			vao.bind()
			program.use()

			for (const unit of game.allUnits) {
				const type = unit.heldItem
				if (type === ItemType.None) continue
				const buffers = itemBuffers[type]
				if (buffers == null)
					throw new Error(`Invalid item id ${type}`)

				const trianglesToRender = buffers.trianglesToRender
				buffers.array.bind()
				buffers.indices.bind()


				let unitData: UnitData = UnitData.Default
				if (unit.activityId === ActivityId.Walking)
					unitData = (unitData & ~UnitData.MaskMoving) | UnitData.Moving
				unitData = (unitData & ~UnitData.MaskRotation) | unit.rotation


				gl.uniform3f(program.uniforms.unitPosition, unit.posX, unit.posY, unit.posZ)
				gl.uniformMatrix4fv(program.uniforms.combinedMatrix, false, toGl(camera.combinedMatrix))
				gl.uniform1f(program.uniforms.activityStartTick, unit.activityStartedAt)
				gl.uniform1i(program.uniforms.unitData, unitData)
				gl.uniform1f(program.uniforms.gameTick, ctx.gameTickEstimation)
				gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

				gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_BYTE, 0)
			}
		},
	}
}

export default createHeldItemRenderable
