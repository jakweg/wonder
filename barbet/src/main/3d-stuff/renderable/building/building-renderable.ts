import { toGl } from '../../../util/matrix/common'
import { BuildingId, requireBuilding } from '../../game-state/buildings/building'
import { DataOffsetBuildingData, DataOffsetPositions, EntityTrait } from '../../game-state/entities/traits'
import { GameState, MetadataField } from '../../game-state/game-state'
import { MainRenderer } from '../../main-renderer'
import { createProgramFromNewShaders } from '../../shader/common'
import { RenderContext } from '../render-context'
import { Attributes, fragmentShaderSource, Uniforms, vertexShaderSource } from './building-shaders'

function prepareRenderer(renderer: MainRenderer) {
	const vao = renderer.createVAO()
	vao.bind()
	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)

	const modelBuffer = renderer.createBuffer(true, false)
	const stride = Float32Array.BYTES_PER_ELEMENT * 7
	modelBuffer.setContent(new Float32Array())
	program.enableAttribute(program.attributes['color'], 3, true, stride, 3 * floatSize, 0)
	program.enableAttribute(program.attributes['position'], 3, true, stride, 0, 0)
	program.enableAttribute(program.attributes['flags'], 1, true, stride, 6 * floatSize, 0)

	const modelElementsBuffer = renderer.createBuffer(false, false)
	modelElementsBuffer.setContent(new Float32Array())
	return {vao, program, modelBuffer, modelElementsBuffer}
}

const createNewBuildingRenderable = (renderer: MainRenderer,
                                     game: GameState) => {
	const {vao, program, modelBuffer, modelElementsBuffer} = prepareRenderer(renderer)

	let trianglesToRender = 0
	let lastRebuildId = 0
	const recreateMeshIfNeeded = () => {
		const lastChangeId = game.metaData[MetadataField.LastBuildingsChange]!
		if (lastRebuildId !== lastChangeId) {
			lastRebuildId = lastChangeId
			renderer.unbindVAO()

			const vertexData: number[] = []
			const elementsData: number[] = []

			const buildingData = game.entities.buildingData.rawData
			const positions = game.entities.positions.rawData
			for (const entity of game.entities
				.iterate(EntityTrait.Position | EntityTrait.BuildingData)) {
				const typeId = buildingData[entity.buildingData + DataOffsetBuildingData.TypeId] as BuildingId
				const building = requireBuilding(typeId)

				const x = positions[entity.position + DataOffsetPositions.PositionX]!
				const y = positions[entity.position + DataOffsetPositions.PositionY]!
				const z = positions[entity.position + DataOffsetPositions.PositionZ]!

				const vertexCountBeforeAdd = vertexData.length / 7 | 0

				const vertexes = building.vertexes
				for (let i = 0, s = vertexes.length; i < s;) {
					const vx = vertexes[i++]! + x
					const vy = vertexes[i++]! + y
					const vz = vertexes[i++]! + z
					const color0 = vertexes[i++]!
					const color1 = vertexes[i++]!
					const color2 = vertexes[i++]!
					const flags = vertexes[i++]!
					vertexData.push(vx, vy, vz, color0, color1, color2, flags)
				}

				const indices = building.indices
				for (const index of indices) {
					elementsData.push(index + vertexCountBeforeAdd)
				}
			}
			trianglesToRender = elementsData.length
			modelBuffer.setContent(new Float32Array(vertexData))
			modelElementsBuffer.setContent(new Uint16Array(elementsData))
		}
	}

	return {
		render(ctx: RenderContext) {
			recreateMeshIfNeeded()
			const {gl, camera} = ctx

			vao.bind()
			program.use()

			gl.uniformMatrix4fv(program.uniforms['combinedMatrix'], false, toGl(camera.combinedMatrix))
			gl.uniform1f(program.uniforms['time'], ctx.secondsSinceFirstRender)

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_SHORT, 0)
		},
	}
}

export default createNewBuildingRenderable
