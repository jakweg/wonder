import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { RenderContext } from '../render-context'
import { ActivityId } from '../unit/activity'
import { buildBoxModel } from './item-model'
import {
	Attributes,
	inHandVertexShader,
	itemFragmentShaderSource,
	onGroundVertexShader,
	Uniforms,
	UnitData,
} from './item-shaders'

export const createNewItemRenderable = (renderer: MainRenderer,
                                        game: GameState) => {
	const itemPositions = [
		// position: x,y,z
		8, 2, 4,
	]

	const mesh = buildBoxModel()
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const itemInHandProgram = createProgramFromNewShaders<Attributes, Uniforms>(renderer, inHandVertexShader, itemFragmentShaderSource)
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, onGroundVertexShader, itemFragmentShaderSource)

	const modelBuffer = renderer.createBuffer(true, false)
	modelBuffer.setContent(mesh.vertexes)
	program.enableAttribute(program.attributes.modelPosition, 3, true, 4 * floatSize, 0, 0)
	program.enableAttribute(program.attributes.flags, 1, true, 4 * floatSize, 3 * floatSize, 0)
	itemInHandProgram.use()
	itemInHandProgram.enableAttribute(itemInHandProgram.attributes.modelPosition, 3, true, 4 * floatSize, 0, 0)
	itemInHandProgram.enableAttribute(itemInHandProgram.attributes.flags, 1, true, 4 * floatSize, 3 * floatSize, 0)


	const unitDataBuffer = renderer.createBuffer(true, false)
	unitDataBuffer.setContent(new Float32Array(itemPositions))
	program.use()
	program.enableAttribute(program.attributes.worldPosition, 3, true, 0, 0, 1)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	modelElementsBuffer.setContent(mesh.elements)

	const trianglesToRender = mesh.trianglesToRender
	const instancesCount = itemPositions.length / 3 | 0
	return {
		render(ctx: RenderContext) {
			const {gl, camera} = ctx
			vao.bind()
			if (game.allUnits[0]?.heldItem === null) {
				program.use()

				gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
				gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
				gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
				gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

				gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_BYTE, 0, instancesCount)
			}

			itemInHandProgram.use()
			for (const unit of game.allUnits) {
				const item = unit.heldItem
				if (item === null) return

				gl.uniform3f(itemInHandProgram.uniforms.unitPosition, unit.posX, unit.posY, unit.posZ)
				gl.uniformMatrix4fv(itemInHandProgram.uniforms.projection, false, toGl(camera.perspectiveMatrix))
				gl.uniformMatrix4fv(itemInHandProgram.uniforms.view, false, toGl(camera.viewMatrix))
				gl.uniform1f(itemInHandProgram.uniforms.time, ctx.secondsSinceFirstRender)
				gl.uniform1f(itemInHandProgram.uniforms.activityStartTick, unit.activityStartedAt)

				let unitData: UnitData = UnitData.Default
				if (unit.activityId === ActivityId.WalkingHoldingItem)
					unitData = (unitData & ~UnitData.MaskMoving) | UnitData.Moving
				unitData = (unitData & ~UnitData.MaskRotation) | 2


				gl.uniform1i(itemInHandProgram.uniforms.unitData, unitData)
				gl.uniform1f(itemInHandProgram.uniforms.gameTick, ctx.gameTickEstimation)
				gl.uniform3fv(itemInHandProgram.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

				gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_BYTE, 0, instancesCount)
			}
		},
	}
}
