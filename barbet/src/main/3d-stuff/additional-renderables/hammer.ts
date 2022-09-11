import { toGl } from '@matrix/common'
import { AdditionalRenderer } from '../../game-state/activities'
import { DataStore } from '../../game-state/entities/data-store'
import {
	DataOffsetDrawables,
	DataOffsetPositions,
	DataOffsetWithActivity,
	EntityTraitIndicesRecord
} from '../../game-state/entities/traits'
import { GameState } from '../../game-state/game-state'
import {
	calculateNormals,
	createProgramFromNewShaders,
	PIConstantHeader,
	PrecisionHeader,
	RotationYMatrix,
	RotationZMatrix, TerrainHeightMultiplierDeclaration,
	VersionHeader
} from '../common-shader'
import GPUBuffer from "../gpu-resources/buffer"
import GlProgram from '../gpu-resources/program'
import { MainRenderer } from '../main-renderer'
import { RenderContext } from '../renderable/render-context'
import { UnitShaderCreationOptions } from '../renderable/unit/shaders'

export const singleMiningAnimationLoopDuration = 20
const hammerTicksInSingleActivityPeriod = 2

const initData = () => {
	const positions = [
		-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
		-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
	]
	const elements = [
		1, 2, 0, 2, 3, 0,
		0, 4, 1, 4, 5, 1,
		1, 5, 2, 5, 6, 2,
		0, 3, 7, 4, 0, 7,
		2, 6, 3, 6, 7, 3,
		4, 7, 5, 7, 6, 5,
	]

	const singleBoxVertexesSize = positions.length
	const singleBoxElementsSize = elements.length
	const finalVertexData = new Float32Array(singleBoxVertexesSize / 3 * 6 * 2)
	console.assert(singleBoxVertexesSize / 3 * 2 < 255)
	const finalElementsData = new Uint8Array(elements.length * 2)

	for (let i = 0, l = positions.length; i < l; i += 3) {
		// stick
		finalVertexData[i * 2] = positions[i]! * 0.07
		finalVertexData[i * 2 + 1] = positions[i + 1]! * 0.5
		finalVertexData[i * 2 + 2] = positions[i + 2]! * 0.07

		// top part
		finalVertexData[singleBoxVertexesSize * 2 + i * 2] = positions[i]! * 0.4
		finalVertexData[singleBoxVertexesSize * 2 + i * 2 + 1] = (positions[i + 1]! - 1) * 0.2
		finalVertexData[singleBoxVertexesSize * 2 + i * 2 + 2] = positions[i + 2]! * 0.2
	}

	for (let i = 0, l = elements.length; i < l; i++) {
		const index = elements[i]!
		finalElementsData[i] = index
		finalElementsData[i + singleBoxElementsSize] = index + positions.length / 3
	}

	calculateNormals(finalElementsData, finalVertexData, 6, 3)

	return { vertexes: finalVertexData, elements: finalElementsData, triangles: finalElementsData.length }
}
type Program = GlProgram<'modelPosition' | 'unitData' | 'activityStart' | 'modelNormals', 'time' | 'combinedMatrix'>
type T = {
	vao: any,
	batchBuffer: GPUBuffer,
	positions: DataStore<Int32Array>,
	drawables: DataStore<Int32Array>,
	withActivities: DataStore<Int32Array>,
	program: Program,
	trianglesToRender: number
}

type B = { unitPositions: number[], count: number }
const HandRotationMatrix = (forHand: boolean) => `
float r = ${forHand ? '' : `${-Math.PI / 2.0} + -`}(abs(sin(activityDuration * ${(Math.PI * hammerTicksInSingleActivityPeriod / singleMiningAnimationLoopDuration).toFixed(7)}) * (${forHand ? 'isBottomVertex ? 1.9 : 1.5' : '1.9'})) - 0.2);
mat4 handRotation = ${RotationZMatrix('r')}
`

export const miningResourceTransformationsSource = (_: UnitShaderCreationOptions) => `
if (isLeftArmVertex) {
	${HandRotationMatrix(true)};
	pos = (handRotation * vec4(pos, 1.0)).xyz;
}
`
const vertexSource = () => `${VersionHeader()}
${PrecisionHeader()}
${PIConstantHeader()}
${TerrainHeightMultiplierDeclaration()}
in vec3 a_modelPosition;
in vec3 a_modelNormals;
in vec4 a_unitData;
in float a_activityStart;
flat out vec3 v_normal;
flat out vec3 v_currentPosition;
uniform float u_time;
uniform mat4 u_combinedMatrix;
void main() {
	float activityDuration = u_time - a_activityStart;
	${HandRotationMatrix(false)};
	
	vec4 pos = vec4(a_modelPosition.x, a_modelPosition.y, a_modelPosition.z, 1);
	pos.x -= 0.33;
	pos.y -= 0.25;
	pos *= handRotation;
	pos.x += 0.5;
	pos.y += 1.1;
	
	pos.x -= 0.5;
	pos.z -= 0.5;
    float unitRotationAngle = PI * a_unitData.w / 4.0;
    mat4 unitRotation = ${RotationYMatrix('unitRotationAngle')};
    pos = unitRotation * pos;
	pos.x += 0.5;
	pos.z += 0.5;
    
	pos.x += a_unitData.x;
	pos.y += a_unitData.y * terrainHeightMultiplier;
	pos.z += a_unitData.z;
	
    gl_Position = u_combinedMatrix * pos;
    v_normal = (handRotation * vec4(a_modelNormals, 1.0)).xyz;
    v_currentPosition = gl_Position.xyz;
}
`
const fragmentSource = () => `${VersionHeader()}
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

const hammer: AdditionalRenderer<T, B> = {
	setup(renderer: MainRenderer, game: GameState): T {
		const data = initData()

		const vao = renderer.createVAO()
		vao.bind()
		const program = createProgramFromNewShaders(renderer, vertexSource(), fragmentSource()) as Program

		const floatSize = Float32Array.BYTES_PER_ELEMENT

		const elementBuffer = renderer.createBuffer(false, false)
		elementBuffer.setContent(data.elements)

		const triangleBuffer = renderer.createBuffer(true, false)
		triangleBuffer.setContent(data.vertexes)
		program.enableAttribute(program.attributes['modelPosition'], 3, true, 6 * floatSize, 0, 0)
		program.enableAttribute(program.attributes['modelNormals'], 3, true, 6 * floatSize, 3 * floatSize, 0)

		const batchBuffer = renderer.createBuffer(true, true)
		batchBuffer.bind()
		program.enableAttribute(program.attributes['unitData'], 4, true, 5 * floatSize, 0, 1)
		program.enableAttribute(program.attributes['activityStart'], 1, true, 5 * floatSize, 4 * floatSize, 1)

		return {
			vao,
			batchBuffer,
			positions: game.entities.positions,
			drawables: game.entities.drawables,
			withActivities: game.entities.withActivities,
			program,
			trianglesToRender: data.triangles,
		}
	},
	prepareBatch(): B {
		return { unitPositions: [], count: 0 }
	},
	appendToBatch(setup: T, batch: B, unit: EntityTraitIndicesRecord): void {
		const positions = setup.positions.rawData
		const unitX = positions[unit.position + DataOffsetPositions.PositionX]!
		const unitY = positions[unit.position + DataOffsetPositions.PositionY]!
		const unitZ = positions[unit.position + DataOffsetPositions.PositionZ]!

		const rotation = setup.drawables.rawData[unit.drawable + DataOffsetDrawables.Rotation]!

		const activityStartTick = setup.withActivities.rawData[unit.withActivity + DataOffsetWithActivity.StartTick]!

		batch.count++
		batch.unitPositions.push(unitX, unitY, unitZ, rotation, activityStartTick)
	},
	executeBatch(setup: T, ctx: RenderContext, batch: B): void {
		const count = batch.count
		if (count === 0) return
		const gl = ctx.gl
		const program = setup.program
		setup.vao.bind()
		program.use()
		setup.batchBuffer.setContent(new Float32Array(batch.unitPositions))

		gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(ctx.camera.combinedMatrix))
		gl.uniform1f(program.uniforms['time'], ctx.gameTickEstimation)

		gl.drawElementsInstanced(gl.TRIANGLES, setup.trianglesToRender, gl.UNSIGNED_BYTE, 0, count)
	},
}

export default hammer
