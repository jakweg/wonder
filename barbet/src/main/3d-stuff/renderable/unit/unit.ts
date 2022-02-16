import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { GlProgram, MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { RenderContext } from '../render-context'
import { allActivities } from './activity'
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

	const programs: GlProgram<Attributes, Uniforms>[] = []
	for (const source of allShaderSources) {
		const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, source, fragmentShaderSource)

		modelBuffer.bind()
		program.enableAttribute(program.attributes.modelPosition, 3, true, 7 * floatSize, 0, 0)
		program.enableAttribute(program.attributes.flags, 1, true, 7 * floatSize, 6 * floatSize, 0)


		unitDataBuffer.bind()
		program.enableAttribute(program.attributes.worldPosition, 3, true, 12 * floatSize, 0, 1)
		program.enableAttribute(program.attributes.primaryColor, 3, true, 12 * floatSize, 3 * floatSize, 1)
		program.enableAttribute(program.attributes.secondaryColor, 3, true, 12 * floatSize, 6 * floatSize, 1)
		program.enableAttribute(program.attributes.faceColor, 3, true, 12 * floatSize, 9 * floatSize, 1)

		programs.push(program)
	}


	const trianglesToRender = mesh.trianglesToRender
	// const instancesCount = unitData.length / 12 | 0
	return {
		render(ctx: RenderContext) {
			const {gl, camera} = ctx
			vao.bind()
			modelBuffer.bind()

			for (const unit of game.allUnits) {
				const activity = allActivities[unit.activityId]
				if (activity == null)
					throw new Error(`Invalid activity id ${unit.activityId}`)
				const program = programs[activity.shaderId]
				if (program == null)
					throw new Error(`Invalid unit program id ${activity.shaderId}`)

				program.use()
				const unitData = []

				unitData.push(unit.posX, unit.posY, unit.posZ,
					...unit.color.primary,
					...unit.color.secondary,
					...unit.color.face)
				unitDataBuffer.setContent(new Float32Array(unitData))


				gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
				gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
				gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
				gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -10, -400))))

				// gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0, instancesCount)
				gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0, 1)
			}
		},
	}
}
