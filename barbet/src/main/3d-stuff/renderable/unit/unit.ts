import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { iterateOverDrawableEntities } from '../../game-state/entities/queries'
import {
	DataOffsetDrawables,
	DataOffsetItemHoldable,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTrait,
} from '../../game-state/entities/traits'
import { GameState } from '../../game-state/game-state'
import { GlProgram, GPUBuffer, MainRenderer } from '../../main-renderer'
import { pickViaMouseDefaultFragmentShader } from '../../shader/common'
import { ItemType } from '../../world/item'
import { RenderContext } from '../render-context'
import { ActivityId, getAllActivities, requireActivity } from './activity'
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
		{forMousePicker: true, holdingItem: false}, {forMousePicker: true, holdingItem: true},
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


	const additionalRenderersSetup: any[] = []
	for (const a of getAllActivities()) {
		const additional = a.additionalRenderer
		if (additional === null) {
			additionalRenderersSetup.push(null)
			continue
		}
		additionalRenderersSetup.push(additional.setup(renderer, game))
	}

	const unitDataBuffer = renderer.createBuffer(true, false)

	const {programs, vao} = preparePrograms(renderer, modelBuffer, modelElementsBuffer, unitDataBuffer)

	const internalRender = (ctx: RenderContext, forMousePicker: boolean) => {

		const {gl, camera: {combinedMatrix}, gameTickEstimation} = ctx
		vao.bind()
		modelBuffer.bind()

		const container = game.entities
		const positions = container.positions.rawData
		const drawables = container.drawables.rawData
		const withActivities = container.withActivities.rawData
		const itemHoldables = container.itemHoldables.rawData

		const batches: any[] = new Array(forMousePicker ? 0 : additionalRenderersSetup.length)

		for (const record of iterateOverDrawableEntities(container)) {

			const unitX = positions[record.position + DataOffsetPositions.PositionX]!
			const unitY = positions[record.position + DataOffsetPositions.PositionY]!
			const unitZ = positions[record.position + DataOffsetPositions.PositionZ]!

			const hasItem = ((record.thisTraits & EntityTrait.ItemHoldable) === EntityTrait.ItemHoldable)
				? (itemHoldables[record.itemHoldable + DataOffsetItemHoldable.ItemId] !== ItemType.None) : false


			const hasActivity = (record.thisTraits & EntityTrait.WithActivity) === EntityTrait.WithActivity
			const activityId = hasActivity ? withActivities[record.withActivity + DataOffsetWithActivity.CurrentId]! : ActivityId.Idle
			const activityStartTick = hasActivity ? withActivities[record.withActivity + DataOffsetWithActivity.StartTick]! : 0

			const activity = requireActivity(activityId)
			const program = programs[activity.shaderId * 4 + (hasItem ? 1 : 0) + (forMousePicker ? 2 : 0)]!
			if (program == null)
				throw new Error(`Invalid unit program id ${activity.shaderId}`)

			if (!forMousePicker) {
				const additionalRenderer = activity.additionalRenderer
				if (additionalRenderer !== null) {
					let batch = batches[activityId]
					if (batch === undefined) {
						batch = additionalRenderer.prepareBatch(additionalRenderersSetup[activityId], ctx)
						batches[activityId] = batch
					}
					additionalRenderer.appendToBatch(additionalRenderersSetup[activityId], batch, record)
				}
			}

			program.use()
			const unitData = []

			unitData.push(unitX, unitY, unitZ,
				forMousePicker
					? (record.thisId / 256)
					: drawables[record.drawable + DataOffsetDrawables.ColorPaletteId]!,
				activityStartTick,
				drawables[record.drawable + DataOffsetDrawables.Rotation]!)

			unitDataBuffer.setContent(new Float32Array(unitData))


			gl.uniformMatrix4fv(program.uniforms.combinedMatrix, false, toGl(combinedMatrix))
			gl.uniform3f(program.uniforms.times, ctx.secondsSinceFirstRender, ctx.gameTime, gameTickEstimation)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -10, -400))))

			gl.drawElementsInstanced(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0, 1)
		}

		if (!forMousePicker)
			for (let i = 0; i < batches.length; i++) {
				const batch = batches[i]
				if (batch === undefined) continue
				requireActivity(i).additionalRenderer?.executeBatch(additionalRenderersSetup[i], ctx, batch)
			}
	}

	return {
		render(ctx: RenderContext) {
			internalRender(ctx, false)
		},

		renderForMousePicker(ctx: RenderContext) {
			internalRender(ctx, true)
		},
	}
}
