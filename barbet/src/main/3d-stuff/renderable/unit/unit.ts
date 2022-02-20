import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { GlProgram, MainRenderer } from '../../main-renderer'
import { RenderContext } from '../render-context'
import { requireActivity } from './activity'
import { buildUnitModel } from './unit-model'
import { allShaderSources, Attributes, fragmentShaderSource, Uniforms } from './unit-shaders'

export const createNewUnitRenderable = (renderer: MainRenderer,
                                        game: GameState) => {
	const mesh = buildUnitModel()
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const modelBuffer = renderer.createBuffer(true, false)
	modelBuffer.setContent(mesh.vertexes)
	const unitDataBuffer = renderer.createBuffer(true, false)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	modelElementsBuffer.setContent(mesh.elements)

	const fragmentShader = renderer.createShader(false, fragmentShaderSource)

	const programs: GlProgram<Attributes, Uniforms>[] = []
	for (const source of allShaderSources) {
		const vertexShader = renderer.createShader(true, source)
		const program = renderer.createProgram<Attributes, Uniforms>(vertexShader, fragmentShader)

		modelBuffer.bind()
		program.enableAttribute(program.attributes.modelPosition, 3, true, 7 * floatSize, 0, 0)
		program.enableAttribute(program.attributes.flags, 1, true, 7 * floatSize, 6 * floatSize, 0)


		unitDataBuffer.bind()
		program.enableAttribute(program.attributes.worldPosition, 3, true, 5 * floatSize, 0, 1)
		program.enableAttribute(program.attributes.colorPaletteId, 1, true, 5 * floatSize, 3 * floatSize, 1)
		program.enableAttribute(program.attributes.activityStartTick, 1, true, 5 * floatSize, 4 * floatSize, 1)

		programs.push(program)
	}


	const trianglesToRender = mesh.trianglesToRender
	return {
		render(ctx: RenderContext) {
			const {gl, camera, gameTickEstimation} = ctx
			vao.bind()
			modelBuffer.bind()

			for (const unit of game.allUnits) {
				const activity = requireActivity(unit.activityId)
				const program = programs[activity.shaderId]
				if (program == null)
					throw new Error(`Invalid unit program id ${activity.shaderId}`)

				program.use()
				const unitData = []

				// const secondsOfActivity = ctx.secondsSinceLastTick + (game.currentTick - unit.activityStartedAt) * (1 / 2)

				unitData.push(unit.posX, unit.posY, unit.posZ, unit.color, unit.activityStartedAt)
				unitDataBuffer.setContent(new Float32Array(unitData))


				gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
				gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
				gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
				gl.uniform1f(program.uniforms.gameTick, gameTickEstimation)
				gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -10, -400))))

				gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0, 1)
			}
		},
	}
}
