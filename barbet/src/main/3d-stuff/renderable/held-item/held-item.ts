import { toGl } from '../../../util/matrix/common'
import { add, clone, fromValues } from '../../../util/matrix/vec3'
import { GameState } from '../../game-state/game-state'
import {
	DataOffsetDrawables,
	DataOffsetItemHoldable,
	DataOffsetPositions,
	DataOffsetWithActivity,
	UnitTraits,
} from '../../game-state/units/traits'
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


			const positions = game.units.positions.rawData
			const drawables = game.units.drawables.rawData
			const withActivities = game.units.withActivities.rawData
			const itemHoldables = game.units.itemHoldables.rawData

			for (const record of game.units.iterate(UnitTraits.ItemHoldable | UnitTraits.Drawable | UnitTraits.Position)) {

				const type = itemHoldables[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType

				if (type === ItemType.None)
					continue

				const unitX = positions[record.position + DataOffsetPositions.PositionX]!
				const unitY = positions[record.position + DataOffsetPositions.PositionY]!
				const unitZ = positions[record.position + DataOffsetPositions.PositionZ]!


				const hasActivity = (record.thisTraits & UnitTraits.WithActivity) === UnitTraits.WithActivity
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


				gl.uniform3f(program.uniforms.unitPosition, unitX, unitY, unitZ)
				gl.uniformMatrix4fv(program.uniforms.combinedMatrix, false, toGl(camera.combinedMatrix))
				gl.uniform1f(program.uniforms.activityStartTick, activityStartTick)
				gl.uniform1i(program.uniforms.unitData, unitData)
				gl.uniform1f(program.uniforms.gameTick, ctx.gameTickEstimation)
				gl.uniform3fv(program.uniforms.lightPosition, toGl(add(clone(ctx.sunPosition), ctx.sunPosition, fromValues(0, -400, 0))))

				gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_BYTE, 0)
			}
		},
	}
}

export default createHeldItemRenderable
