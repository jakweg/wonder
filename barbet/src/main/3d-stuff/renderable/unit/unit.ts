import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { GlProgram, GPUBuffer, MainRenderer } from '../../main-renderer'
import { pickViaMouseDefaultFragmentShader } from '../../shader/common'
import { ItemType } from '../../world/item'
import { RenderContext } from '../render-context'
import { requireActivity } from './activity'
import { buildUnitModel } from './unit-model'
import {
	Attributes,
	constructUnitVertexShaderSource,
	shaderTransformationSources,
	standardFragmentShaderSource,
	Uniforms,
} from './unit-shaders'

function createBuffersForModelMesh(renderer: MainRenderer) {
	renderer.unbindVAO()
	const mesh = buildUnitModel()
	const trianglesToRender = mesh.trianglesToRender

	const modelBuffer = renderer.createBuffer(true, false)
	const modelElementsBuffer = renderer.createBuffer(false, false)

	modelBuffer.setContent(mesh.vertexes)
	modelElementsBuffer.setContent(mesh.elements)
	return {trianglesToRender, modelBuffer, modelElementsBuffer}
}

function preparePrograms(renderer: MainRenderer, modelBuffer: GPUBuffer, modelElementsBuffer: GPUBuffer, unitDataBuffer: GPUBuffer) {
	const vao = renderer.createVAO()
	vao.bind()
	modelElementsBuffer.bind()

	const standardFragmentShader = renderer.createShader(false, standardFragmentShaderSource)
	const mouseFragmentShader = renderer.createShader(false, pickViaMouseDefaultFragmentShader)
	const programs: GlProgram<Attributes, Uniforms>[] = []
	const variants = [
		{forMousePicker: false, holdingItem: false}, {forMousePicker: false, holdingItem: true},
		{forMousePicker: true, holdingItem: true}, {forMousePicker: true, holdingItem: true},
	]

	const sourceToShaderMap = new Map<string, WebGLShader>()
	const sourceToProgramMap = new Map<string, GlProgram<Attributes, Uniforms>>()

	for (const transformSource of shaderTransformationSources()) {
		for (const options of variants) {
			const source = constructUnitVertexShaderSource(transformSource(options), options)


			let program = sourceToProgramMap.get(source)
			if (program === undefined) {
				let vertexShader = sourceToShaderMap.get(source)
				if (vertexShader === undefined) {
					vertexShader = renderer.createShader(true, source)
					sourceToShaderMap.set(source, vertexShader)
				}

				program = renderer.createProgram<Attributes, Uniforms>(vertexShader,
					options.forMousePicker ? mouseFragmentShader : standardFragmentShader)
				sourceToProgramMap.set(source, program)
			}


			modelBuffer.bind()
			program.enableAttribute(program.attributes.modelPosition, 3, true, 7 * 4, 0, 0)
			program.enableAttribute(program.attributes.flags, 1, true, 7 * 4, 6 * 4, 0)


			unitDataBuffer.bind()
			program.enableAttribute(program.attributes.worldPosition, 3, true, 6 * 4, 0, 1)
			program.enableAttribute(program.attributes.unitId, 1, true, 6 * 4, 3 * 4, 1)
			program.enableAttribute(program.attributes.colorPaletteId, 1, true, 6 * 4, 3 * 4, 1)
			program.enableAttribute(program.attributes.activityStartTick, 1, true, 6 * 4, 4 * 4, 1)
			program.enableAttribute(program.attributes.unitRotation, 1, true, 6 * 4, 5 * 4, 1)

			programs.push(program)
		}
	}
	return {programs, vao}
}

export const createNewUnitRenderable = (renderer: MainRenderer,
                                        game: GameState) => {
	const {trianglesToRender, modelBuffer, modelElementsBuffer} = createBuffersForModelMesh(renderer)

	const unitDataBuffer = renderer.createBuffer(true, false)

	const {programs, vao} = preparePrograms(renderer, modelBuffer, modelElementsBuffer, unitDataBuffer)

	return {
		render(ctx: RenderContext) {
			const {gl, camera: {combinedMatrix}, gameTickEstimation} = ctx
			vao.bind()
			modelBuffer.bind()

			for (const unit of game.allUnits) {
				const activity = requireActivity(unit.activityId)
				const program = programs[activity.shaderId * 4 + (unit.heldItem !== ItemType.None ? 1 : 0)]
				if (program == null)
					throw new Error(`Invalid unit program id ${activity.shaderId}`)

				program.use()
				const unitData = []

				unitData.push(unit.posX, unit.posY, unit.posZ, unit.color, unit.activityStartedAt, unit.rotation)
				unitDataBuffer.setContent(new Float32Array(unitData))


				gl.uniformMatrix4fv(program.uniforms.combinedMatrix, false, toGl(combinedMatrix))
				gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
				gl.uniform1f(program.uniforms.gameTick, gameTickEstimation)
				gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -10, -400))))

				gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0, 1)
			}
		},

		renderForMousePicker(ctx: RenderContext) {
			const {gl, gameTickEstimation, camera: {combinedMatrix}} = ctx
			vao.bind()
			modelBuffer.bind()

			for (const unit of game.allUnits) {
				const activity = requireActivity(unit.activityId)
				const program = programs[activity.shaderId * 4 + (unit.heldItem !== ItemType.None ? 1 : 0) + 2]
				if (program == null)
					throw new Error(`Invalid unit program id ${activity.shaderId}`)

				program.use()
				const unitData = []

				unitData.push(unit.posX, unit.posY, unit.posZ, unit.numericId / 256, unit.activityStartedAt, unit.rotation)
				unitDataBuffer.setContent(new Float32Array(unitData))


				gl.uniformMatrix4fv(program.uniforms.combinedMatrix, false, toGl(combinedMatrix))
				gl.uniform1f(program.uniforms.gameTick, gameTickEstimation)
				gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)

				gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0, 1)
			}
		},
	}
}
