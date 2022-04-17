import { toGl } from '@matrix//common'
import { add, clone, fromValues } from '@matrix//vec3'
import { ActivityId } from '../../../game-state/activities'
import { iterateOverEntitiesHoldingItems } from '../../../game-state/entities/queries'
import {
	DataOffsetDrawables,
	DataOffsetItemHoldable,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTrait,
} from '../../../game-state/entities/traits'
import { GameState } from '../../../game-state/game-state'
import { allItems, ItemType } from '../../../game-state/world/item'
import { createProgramFromNewShaders } from '../../common-shader'
import { MainRenderer } from '../../main-renderer'
import { RenderContext } from '../render-context'
import { Attributes, inHandVertexShader, itemFragmentShaderSource, Uniforms, UnitData } from './shaders'

function prepareRenderer(renderer: MainRenderer) {
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, inHandVertexShader, itemFragmentShaderSource)

	program.enableAttribute(program.attributes['modelPosition'], 3, true, 4 * floatSize, 0, 0)
	program.enableAttribute(program.attributes['flags'], 1, true, 4 * floatSize, 3 * floatSize, 0)

	return {vao, program}
}

const createHeldItemRenderable = (renderer: MainRenderer,
                                  game: GameState) => {
	const {vao, program} = prepareRenderer(renderer)

	const itemBuffers = allItems.map(item => item.createMeshBuffer(renderer))
	for (const {array} of itemBuffers) {
		if (array == null) continue
		array.bind()
		program.enableAttribute(program.attributes['modelPosition'], 3, true, 4 * 4, 0, 0)
		program.enableAttribute(program.attributes['flags'], 1, true, 4 * 4, 3 * 4, 0)
	}

	return {
		render: function (ctx: RenderContext) {
			const {gl, camera} = ctx

			vao.bind()
			program.use()


			const positions = game.entities.positions.rawData
			const drawables = game.entities.drawables.rawData
			const withActivities = game.entities.withActivities.rawData
			const itemHoldables = game.entities.itemHoldables.rawData

			for (const record of iterateOverEntitiesHoldingItems(game.entities)) {
				const type = itemHoldables[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType

				if (type === ItemType.None)
					continue

				const unitX = positions[record.position + DataOffsetPositions.PositionX]!
				const unitY = positions[record.position + DataOffsetPositions.PositionY]!
				const unitZ = positions[record.position + DataOffsetPositions.PositionZ]!


				const hasActivity = (record.thisTraits & EntityTrait.WithActivity) === EntityTrait.WithActivity
				const activityId = hasActivity ? withActivities[record.withActivity + DataOffsetWithActivity.CurrentId]! : ActivityId.Idle
				const activityStartTick = hasActivity ? withActivities[record.withActivity + DataOffsetWithActivity.StartTick]! : 0

				const rotation = drawables[record.drawable + DataOffsetDrawables.Rotation]!


				const buffers = itemBuffers[type]
				if (buffers == null)
					throw new Error(`Invalid item id ${type}`)

				const trianglesToRender = buffers.trianglesToRender
				buffers.array.bind()
				buffers.indices.bind()


				let unitData: UnitData = UnitData.Default
				if (activityId === ActivityId.Walking)
					unitData = (unitData & ~UnitData.MaskMoving) | UnitData.Moving
				unitData = (unitData & ~UnitData.MaskRotation) | rotation


				gl.uniform3f(program.uniforms['unitPosition'], unitX, unitY, unitZ)
				gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(camera.combinedMatrix))
				gl.uniform1f(program.uniforms['activityStartTick'], activityStartTick)
				gl.uniform1i(program.uniforms['unitData'], unitData)
				gl.uniform1f(program.uniforms['gameTick'], ctx.gameTickEstimation)
				gl.uniform3fv(program.uniforms['lightPosition'], toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

				gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_BYTE, 0)
			}
		},
	}
}

export default createHeldItemRenderable
