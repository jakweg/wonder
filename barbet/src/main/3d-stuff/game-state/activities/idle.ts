import { toGl } from '../../../util/matrix/common'
import * as mat4 from '../../../util/matrix/mat4'
import { GlProgram, GPUBuffer, MainRenderer } from '../../main-renderer'
import { RenderContext } from '../../renderable/render-context'
import { ActivityId, AdditionalRenderer } from '../../renderable/unit/activity'
import { ShaderId, UnitShaderCreationOptions } from '../../renderable/unit/unit-shaders'
import { createProgramFromNewShaders, PrecisionHeader, VersionHeader } from '../../shader/common'
import { ItemType } from '../../world/item'
import { DataStore } from '../entities/data-store'
import {
	DataOffsetInterruptible,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTrait,
	EntityTraitIndicesRecord,
	requireTrait,
} from '../entities/traits'
import { GameState } from '../game-state'
import activityBuildingRoot from './buildingRoot'
import { InterruptType } from './interrupt'
import activityItemPickupRoot from './item-pickup-root'
import walkingByPathRoot from './walking-by-path-root'

type Program = GlProgram<'modelPosition' | 'unitPosition', 'rotation' | 'combinedMatrix'>
type T = { vao: any, batchBuffer: GPUBuffer, positions: DataStore<Int32Array>, program: Program }
type B = { unitPositions: number[], count: number }

const vertexSource = `${VersionHeader()}
${PrecisionHeader()}
in vec2 a_modelPosition;
in vec3 a_unitPosition;
uniform mat4 u_rotation;
uniform mat4 u_combinedMatrix;
void main() {
	vec4 pos = u_rotation * vec4(a_modelPosition.x, 1.0, a_modelPosition.y, 1);
	pos.x += a_unitPosition.x + 0.5;
	pos.y += a_unitPosition.y + 0.9;
	pos.z += a_unitPosition.z + 0.5;
    gl_Position = u_combinedMatrix * pos;
}
`
const fragmentSource = `${VersionHeader()}
${PrecisionHeader()}
out vec3 finalColor;
void main() {
	finalColor = vec3(1, 0, 0);
}
`
const additionalRenderer: AdditionalRenderer<T, B> = {
	setup: function (renderer: MainRenderer, game: GameState): T {
		const vao = renderer.createVAO()
		vao.bind()
		const program = createProgramFromNewShaders(renderer, vertexSource, fragmentSource) as Program

		const triangleBuffer = renderer.createBuffer(true, false)
		const r = 0.3
		triangleBuffer.setContent(new Float32Array([0, 2, 1]
			.map(e => Math.PI * e * 2 / 3)
			.flatMap(e => [r * Math.cos(e), r * Math.sin(e)])),
		)
		const floatSize = Float32Array.BYTES_PER_ELEMENT
		program.enableAttribute(program.attributes['modelPosition'], 2, true, 2 * floatSize, 0, 0)

		const batchBuffer = renderer.createBuffer(true, true)
		batchBuffer.bind()
		program.enableAttribute(program.attributes['unitPosition'], 3, true, 3 * floatSize, 0, 1)

		return {vao, batchBuffer, positions: game.entities.positions, program}
	},
	prepareBatch(): B {
		return {unitPositions: [], count: 0}
	},
	appendToBatch(setup: T, batch: B, unit: EntityTraitIndicesRecord): void {
		const positions = setup.positions.rawData
		const unitX = positions[unit.position + DataOffsetPositions.PositionX]!
		const unitY = positions[unit.position + DataOffsetPositions.PositionY]!
		const unitZ = positions[unit.position + DataOffsetPositions.PositionZ]!

		batch.count++
		batch.unitPositions.push(unitX, unitY, unitZ)
	},
	executeBatch(setup: T, ctx: RenderContext, batch: B): void {
		const count = batch.count
		if (count === 0) return
		const program = setup.program
		const gl = ctx.gl
		setup.vao.bind()
		program.use()
		setup.batchBuffer.setContent(new Float32Array(batch.unitPositions))

		gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(ctx.camera.combinedMatrix))

		gl.uniformMatrix4fv(program.uniforms['rotation'], false, toGl(mat4.fromYRotation(mat4.create(), ctx.secondsSinceFirstRender * 5)))
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, count)
	},
}

const activityIdle = {
	numericId: ActivityId.Idle,
	shaderId: ShaderId.Idle,
	additionalRenderer: additionalRenderer,
	perform(game: GameState, unit: EntityTraitIndicesRecord) {

		const memory = game.entities.interruptibles.rawData
		const interrupt = memory[unit.interruptible + DataOffsetInterruptible.InterruptType]! as InterruptType
		if (interrupt === InterruptType.None) return

		memory[unit.interruptible + DataOffsetInterruptible.InterruptType]! = InterruptType.None

		switch (interrupt) {
			case InterruptType.Walk: {
				const x = memory[unit.interruptible + DataOffsetInterruptible.ValueA]!
				const y = memory[unit.interruptible + DataOffsetInterruptible.ValueB]!
				walkingByPathRoot.setup(game, unit, x, y, 0)
				break
			}
			case InterruptType.ItemPickUp: {
				const x = memory[unit.interruptible + DataOffsetInterruptible.ValueA]!
				const y = memory[unit.interruptible + DataOffsetInterruptible.ValueB]!
				const type = memory[unit.interruptible + DataOffsetInterruptible.ValueC]! as ItemType
				activityItemPickupRoot.setup(game, unit, x, y, type)
				break
			}
			case InterruptType.BuildSomeBuilding: {
				const id = memory[unit.interruptible + DataOffsetInterruptible.ValueA]!
				activityBuildingRoot.setup(game, unit, id)
				break
			}
			default:
				throw new Error(`Invalid interrupt ${interrupt}`)
		}
	},
	setup(game: GameState, unit: EntityTraitIndicesRecord) {
		requireTrait(unit.thisTraits, EntityTrait.Interruptible)

		const withActivitiesMemory = game.entities.withActivities.rawData

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.Idle
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = game.currentTick
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] = 0
	},
}
export default activityIdle

export const idleVertexTransformationsSource = (options: UnitShaderCreationOptions) => {
	const tmp: string[] = []
	if (options.holdingItem) {
		tmp.push(`
if (isLeftArmVertex || isRightArmVertex) {
	pos.x += sin(5.0 / PI / 1.0) * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9 - cos(10.0 / PI / 1.0) * -0.5;
}
`)
	} else {
		tmp.push(`
if (isAnimatableElement && !isTopVertex) {
	float additionalZOffset = sin(u_times.x * 2.0) * (isBottomVertex ? -0.18 : -0.06);
	if (isLeftArmVertex)
		pos.x -= additionalZOffset;
	else if (isRightArmVertex)
		pos.x += additionalZOffset;
}
`)
	}

	tmp.push(`
pos.y += sin(u_times.x) * 0.02;
`)
	return tmp.join('\n')
}
