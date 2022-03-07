import { Direction } from '../../../util/direction'
import { toGl } from '../../../util/matrix/common'
import { GlProgram, GPUBuffer, MainRenderer } from '../../main-renderer'
import { RenderContext } from '../../renderable/render-context'
import { ActivityId, AdditionalRenderer } from '../../renderable/unit/activity'
import { ShaderId, UnitShaderCreationOptions } from '../../renderable/unit/unit-shaders'
import {
	createProgramFromNewShaders,
	PIConstantHeader,
	PrecisionHeader,
	RotationZMatrix,
	VersionHeader,
} from '../../shader/common'
import { DataStore } from '../entities/data-store'
import {
	DataOffsetDrawables,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTraitIndicesRecord,
} from '../entities/traits'
import { GameState } from '../game-state'

const miningDuration = 20


const rootVertexes = [
	-0.5, -0.5, -0.5, 0, 0, 0,
	0.5, -0.5, -0.5, 0, 0, 0,
	0.5, -0.5, 0.5, 0, 0, 0,
	-0.5, -0.5, 0.5, 0, 0, 0,

	-0.5, 0.5, -0.5, 0, 0, 0,
	0.5, 0.5, -0.5, 0, 0, 0,
	0.5, 0.5, 0.5, 0, 0, 0,
	-0.5, 0.5, 0.5, 0, 0, 0,
]

const elements = [
	// bottom
	1, 2, 0,
	2, 3, 0,
	// bottom front
	0, 4, 1,
	4, 5, 1,
	// bottom right side
	1, 5, 2,
	5, 6, 2,
	// bottom left side
	0, 3, 7,
	4, 0, 7,
	// bottom back
	2, 6, 3,
	6, 7, 3,
	// top
	4, 7, 5,
	7, 6, 5,
]


let initialized = false

function setupNormals(VERTEX_SIZE: number) {
	for (let i = 0, l = elements.length; i < l;) {
		const a = elements[i++]!
		const b = elements[i++]!
		const c = elements[i++]!


		const aIndex = a * VERTEX_SIZE
		const ax = rootVertexes[aIndex]!
		const ay = rootVertexes[aIndex + 1]!
		const az = rootVertexes[aIndex + 2]!

		const bIndex = b * VERTEX_SIZE
		const bx = rootVertexes[bIndex]!
		const by = rootVertexes[bIndex + 1]!
		const bz = rootVertexes[bIndex + 2]!

		const cIndex = c * VERTEX_SIZE
		// const cx = rootVertexes[cIndex]!
		// const cy = rootVertexes[cIndex + 1]!
		// const cz = rootVertexes[cIndex + 2]!

		const nx = ay * bz - az * by
		const ny = az * bx - ax * bz
		const nz = ax * by - ay * bx

		rootVertexes[cIndex + 3] = nx
		rootVertexes[cIndex + 4] = ny
		rootVertexes[cIndex + 5] = nz
	}
}

const initData = () => {
	if (initialized) return
	initialized = true
	const VERTEX_SIZE = 6
	const beforeData = [...rootVertexes]

	for (let i = 0, l = rootVertexes.length; i < l; i += 6) {
		rootVertexes[i] = rootVertexes[i]! * 0.07
		rootVertexes[i + 1] = rootVertexes[i + 1]! * 0.5
		rootVertexes[i + 2] = rootVertexes[i + 2]! * 0.07
	}

	const before = rootVertexes.length / VERTEX_SIZE
	for (let i = 0, l = beforeData.length; i < l; i += 6) {
		rootVertexes.push(
			beforeData[i]! * 0.4,
			(beforeData[i + 1]! - 1) * 0.2,
			beforeData[i + 2]! * 0.2,
			beforeData[i + 3]!,
			beforeData[i + 4]!,
			beforeData[i + 5]!,
		)
	}

	for (let i = 0, l = elements.length; i < l; i++) {
		elements.push(elements[i]! + before)
	}
	setupNormals(VERTEX_SIZE)
}

type Program = GlProgram<'modelPosition' | 'unitData' | 'modelNormals', 'time' | 'combinedMatrix'>
type T = { vao: any, batchBuffer: GPUBuffer, positions: DataStore<Int32Array>, withActivities: DataStore<Int32Array>, program: Program }
type B = { unitPositions: number[] }

export const miningResourceTransformationsSource = (_: UnitShaderCreationOptions) => `
if (isLeftArmVertex) {
	float r = abs(sin(activityDuration / PI / 30.0 * ${miningDuration.toFixed(1)}) * (isBottomVertex ? 1.9 : 1.5)) - 0.2;
	mat4 handRotation = ${RotationZMatrix('r')};
	pos = (handRotation * vec4(pos, 1.0)).xyz;
}
`

const vertexSource = `${VersionHeader()}
${PrecisionHeader()}
${PIConstantHeader()}
in vec3 a_modelPosition;
in vec3 a_modelNormals;
in vec4 a_unitData;
flat out vec3 v_normal;
flat out vec3 v_currentPosition;
uniform float u_time;
uniform mat4 u_combinedMatrix;
void main() {
	float activityDuration = u_time - a_unitData.w;
	float r = -PI / 2.0 + -(abs(sin(activityDuration / PI / 30.0 * ${miningDuration.toFixed(1)}) * 1.9) - 0.2);
	mat4 handRotation = ${RotationZMatrix('r')};
	
	vec4 pos = vec4(a_modelPosition.x, a_modelPosition.y, a_modelPosition.z, 1);
	pos.x -= 0.33;
	pos.y -= 0.25;
	pos *= handRotation;
	pos.x += 0.5;
	pos.y += 1.1;
	pos.x += a_unitData.x;
	pos.y += a_unitData.y;
	pos.z += a_unitData.z ;
    gl_Position = u_combinedMatrix * pos;
    v_normal = (handRotation * vec4(a_modelNormals, 1.0)).xyz;
    v_currentPosition = gl_Position.xyz;
}
`
const fragmentSource = `${VersionHeader()}
${PrecisionHeader()}
out vec3 finalColor;
flat in vec3 v_normal;
flat in vec3 v_currentPosition;
uniform vec3 u_lightPosition;
const float ambientLight = 0.3;
void main() {
	vec3 lightDirection = normalize(vec3(u_lightPosition) - v_currentPosition);
	float diffuse = max(sqrt(dot(v_normal, lightDirection)), ambientLight);
	finalColor = vec3(1, 1, 1) * diffuse;
}
`
const additionalRenderer: AdditionalRenderer<T, B> = {
	setup(renderer: MainRenderer, game: GameState): T {
		initData()

		const vao = renderer.createVAO()
		vao.bind()
		const program = createProgramFromNewShaders(renderer, vertexSource, fragmentSource) as Program

		const floatSize = Float32Array.BYTES_PER_ELEMENT

		const elementBuffer = renderer.createBuffer(false, false)
		elementBuffer.setContent(new Uint8Array(elements))

		const triangleBuffer = renderer.createBuffer(true, false)
		triangleBuffer.setContent(new Float32Array(rootVertexes))
		program.enableAttribute(program.attributes.modelPosition, 3, true, 6 * floatSize, 0, 0)
		program.enableAttribute(program.attributes.modelNormals, 3, true, 6 * floatSize, 3 * floatSize, 0)

		const batchBuffer = renderer.createBuffer(true, true)
		batchBuffer.bind()
		program.enableAttribute(program.attributes.unitData, 4, true, 4 * floatSize, 0, 1)

		return {
			vao,
			batchBuffer,
			positions: game.entities.positions,
			withActivities: game.entities.withActivities,
			program,
		}
	},
	prepareBatch(): B {
		return {unitPositions: []}
	},
	appendToBatch(setup: T, batch: B, unit: EntityTraitIndicesRecord): void {
		const positions = setup.positions.rawData
		const unitX = positions[unit.position + DataOffsetPositions.PositionX]!
		const unitY = positions[unit.position + DataOffsetPositions.PositionY]!
		const unitZ = positions[unit.position + DataOffsetPositions.PositionZ]!

		const activityStartTick = setup.withActivities.rawData[unit.withActivity + DataOffsetWithActivity.StartTick]!

		batch.unitPositions.push(unitX, unitY, unitZ, activityStartTick)
	},
	executeBatch(setup: T, ctx: RenderContext, batch: B): void {
		const gl = ctx.gl
		const program = setup.program
		setup.vao.bind()
		program.use()
		setup.batchBuffer.setContent(new Float32Array(batch.unitPositions))

		gl.uniformMatrix4fv(program.uniforms.combinedMatrix, false, toGl(ctx.camera.combinedMatrix))
		gl.uniform1f(program.uniforms.time, ctx.gameTickEstimation)

		gl.drawElementsInstanced(gl.TRIANGLES, elements.length, gl.UNSIGNED_BYTE, 0, 1)
	},
}

const enum MemoryField {
	ActivityFinishTick,
	Direction,
	SIZE,
}

const activityMiningResource = {
	numericId: ActivityId.MiningResource,
	shaderId: ShaderId.MiningResource,
	additionalRenderer: additionalRenderer,
	perform(game: GameState, unit: EntityTraitIndicesRecord) {
	},
	setup(game: GameState, unit: EntityTraitIndicesRecord, direction: Direction) {
		const now = game.currentTick
		const memory = game.entities.activitiesMemory.rawData
		const withActivitiesMemory = game.entities.withActivities.rawData
		const pointer = (withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.MemoryPointer] += MemoryField.SIZE)

		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.StartTick] = now
		withActivitiesMemory[unit.withActivity + DataOffsetWithActivity.CurrentId] = ActivityId.MiningResource

		const drawablesData = game.entities.drawables.rawData
		const oldRotation = drawablesData[unit.drawable + DataOffsetDrawables.Rotation]!
		drawablesData[unit.drawable + DataOffsetDrawables.Rotation] = Direction.FlagMergeWithPrevious | ((oldRotation & Direction.MaskCurrentRotation) << 3) | direction

		memory[pointer - MemoryField.ActivityFinishTick] = now + miningDuration
		memory[pointer - MemoryField.Direction] = direction
	},
}

export default activityMiningResource
