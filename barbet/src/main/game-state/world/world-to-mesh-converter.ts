import { AIR_ID, allBlocks, BlockId } from './block'

const NO_ELEMENT_INDEX_MARKER = 4294967295
const NO_COLOR_VALUE = 2
const NO_FLAGS_VALUE = 0

const FLOATS_PER_VERTEX = 6


export interface Mesh {
	vertexes: Float32Array,
	indices: Uint32Array,
}

interface WorldLike {
	size: { sizeX: number, sizeY: number, sizeZ: number }
	rawBlockData: Uint8Array
}

export const buildChunkMesh = (world: WorldLike, chunkX: number, chunkZ: number, chunkSize: number): Mesh => {
	const { sizeX, sizeY, sizeZ } = world.size
	const worldData = world.rawBlockData

	const vertexIndexes = new Uint32Array((chunkSize + 1) * (sizeY + 1) * (chunkSize + 1))
	vertexIndexes.fill(NO_ELEMENT_INDEX_MARKER)
	console.assert(vertexIndexes[0] === NO_ELEMENT_INDEX_MARKER)

	const vertexes: number[] = []
	const indices: number[] = []

	let addedVertexesCounter = 0

	const vertexesPerY = (chunkSize + 1) * (chunkSize + 1)

	const vertexesPerX = (chunkSize + 1)

	const isBlockAir = (x: number, y: number, z: number): number => {
		if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ)
			return 1
		const thisBlockId = worldData[y * sizeX * sizeZ + x * sizeZ + z]! as BlockId
		return thisBlockId === AIR_ID ? 1 : 0
	}

	const computeAmbientOcclusionOld = (x: number, y: number, z: number): number => {
		const nx = x - 1
		const ny = y - 1
		const nz = z - 1
		const index = isBlockAir(x, y, z) +
			isBlockAir(nx, y, z) +
			isBlockAir(x, y, nz) +
			isBlockAir(nx, y, nz) +
			isBlockAir(x, ny, z) +
			isBlockAir(nx, ny, z) +
			isBlockAir(x, ny, nz) +
			isBlockAir(nx, ny, nz)


		return (index!) << 16
	}

	const forceAddVertex = (positionIndex: number, x: number, y: number, z: number): number => {
		vertexes.push(x, y, z, NO_COLOR_VALUE, NO_FLAGS_VALUE | computeAmbientOcclusionOld(x, y, z), NO_FLAGS_VALUE)
		vertexIndexes[positionIndex] = addedVertexesCounter
		return addedVertexesCounter++
	}

	const startX = chunkX * chunkSize
	const startZ = chunkZ * chunkSize
	const addVertexIfNotExists = (x: number, y: number, z: number): number => {
		const positionIndex = y * vertexesPerY + (x - startX) * vertexesPerX + (z - startZ)
		const elementIndex = vertexIndexes[positionIndex]!
		if (elementIndex === NO_ELEMENT_INDEX_MARKER) {
			return forceAddVertex(positionIndex, x, y, z)
		}
		return elementIndex
	}

	const setVertexData = (vertexIndex: number,
		colorValue: number,
		encodedNormal: number,
		forX: number, forY: number, forZ: number): number => {
		let vertexStartIndex = vertexIndex * FLOATS_PER_VERTEX
		const wasNeverUsed = vertexes[vertexStartIndex + 3]! === NO_COLOR_VALUE

		const x = vertexes[vertexStartIndex]!
		const y = vertexes[vertexStartIndex + 1]!
		const z = vertexes[vertexStartIndex + 2]!
		if (!wasNeverUsed) {
			const positionIndex = y * vertexesPerY + (x - startX) * vertexesPerX + (z - startZ)
			vertexIndex = forceAddVertex(positionIndex, x, y, z)
			vertexStartIndex = vertexIndex * FLOATS_PER_VERTEX
		}
		vertexes[vertexStartIndex + 3] = colorValue

		const ox = x - forX
		const oy = y - forY
		const oz = z - forZ
		if (ox < 0 || oy < 0 || oz < 0 || ox > 1 || oy > 1 || oz > 1)
			throw new Error(`Invalid offset ${ox} ${oy} ${oz}`)
		vertexes[vertexStartIndex + 4] = encodedNormal | ((ox << 4 | oy << 2 | oz) << 8) | vertexes[vertexStartIndex + 4]!
		return vertexIndex
	}

	for (let y = 0; y < sizeY; y++) {
		for (let z = chunkZ * chunkSize, mz = Math.min((chunkZ + 1) * chunkSize, sizeZ); z < mz; z++) {
			for (let x = chunkX * chunkSize, mx = Math.min((chunkX + 1) * chunkSize, sizeX); x < mx; x++) {
				const thisBlockId = worldData[y * sizeX * sizeZ + x * sizeZ + z]! as BlockId
				if (thisBlockId === AIR_ID) continue

				const needsTop = y === sizeY - 1 || worldData[(y + 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockId === AIR_ID
				// const needsBottom = y === 0 || worldData[(y - 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockId === AIR_ID
				const needsBottom = false // disabled temporarily
				const needsPositiveZ = z === sizeZ - 1 || worldData[y * sizeX * sizeZ + x * sizeZ + (z + 1)]! as BlockId === AIR_ID
				const needsNegativeZ = z === 0 || worldData[y * sizeX * sizeZ + x * sizeZ + (z - 1)]! as BlockId === AIR_ID
				const needsPositiveX = x === sizeX - 1 || worldData[y * sizeX * sizeZ + (x + 1) * sizeZ + z]! as BlockId === AIR_ID
				const needsNegativeX = x === 0 || worldData[y * sizeX * sizeZ + (x - 1) * sizeZ + z]! as BlockId === AIR_ID

				const needsHorizontal = needsTop || needsBottom
				const needsAnySide = needsPositiveZ || needsNegativeZ || needsPositiveX || needsNegativeX
				if (!(needsHorizontal || needsAnySide)) continue
				let e1 = 0, e2 = 0, e3 = 0, e4 = 0, e5 = 0, e6 = 0, e7 = 0, e8 = 0

				if (needsTop || needsAnySide) {
					e1 = addVertexIfNotExists(x, y + 1, z)
					e2 = addVertexIfNotExists(x, y + 1, z + 1)
					e3 = addVertexIfNotExists(x + 1, y + 1, z + 1)
					e4 = addVertexIfNotExists(x + 1, y + 1, z)
				}

				if (needsBottom || needsAnySide) {
					e5 = addVertexIfNotExists(x, y, z)
					e6 = addVertexIfNotExists(x, y, z + 1)
					e7 = addVertexIfNotExists(x + 1, y, z + 1)
					e8 = addVertexIfNotExists(x + 1, y, z)
				}

				const thisBlock = allBlocks[thisBlockId]!
				const color = thisBlock.color

				if (needsTop) {
					e1 = setVertexData(e1, color, 0b011001, x, y, z)
					indices.push(
						e2, e3, e1,
						e3, e4, e1,
					)
				}

				// if (needsBottom) {
				// 	e5 = setVertexData(e5, topColor, 0b010001,x,y,z)
				// 	elements.push(
				// 		e7, e6, e5,
				// 		e8, e7, e5,
				// 	)
				// }

				const sideColor = color
				if (needsPositiveX) {
					e7 = setVertexData(e7, sideColor, 0b100101, x, y, z)
					indices.push(
						e4, e3, e7,
						e8, e4, e7,
					)
				}

				if (needsNegativeX) {
					e2 = setVertexData(e2, sideColor, 0b000101, x, y, z)
					indices.push(
						e1, e5, e2,
						e5, e6, e2,
					)
				}

				if (needsPositiveZ) {
					e3 = setVertexData(e3, sideColor, 0b010110, x, y, z)
					indices.push(
						e2, e6, e3,
						e6, e7, e3,
					)
				}

				if (needsNegativeZ) {
					e8 = setVertexData(e8, sideColor, 0b010100, x, y, z)
					indices.push(
						e1, e4, e8,
						e5, e1, e8,
					)
				}
			}
		}
	}

	const extractAOFromVertex = (index: number) => (vertexes[index * FLOATS_PER_VERTEX + 4]! >> 16) & 0b1111
	const putFlatAOFromVertex = (index: number, a: number, b: number, c: number, d: number) => vertexes[index * FLOATS_PER_VERTEX + 5]
		= (((a & 0b1111) << 0) | ((b & 0b1111) << 4) | ((c & 0b1111) << 8) | ((d & 0b1111) << 12))

	const squaresCount = indices.length / 6 | 0
	for (let i = 0; i < squaresCount; ++i) {
		const i0 = indices[i * 6 + 0]!
		const i1 = indices[i * 6 + 1]!
		const i2 = indices[i * 6 + 2]!
		const i3 = indices[i * 6 + 3]!
		const i4 = indices[i * 6 + 4]!
		const i5 = indices[i * 6 + 5]!


		if (i0 !== i4) {
			putFlatAOFromVertex(i2, extractAOFromVertex(i0), extractAOFromVertex(i1), extractAOFromVertex(i2), extractAOFromVertex(i4))
			putFlatAOFromVertex(i5, extractAOFromVertex(i3), extractAOFromVertex(i4), extractAOFromVertex(i5), extractAOFromVertex(i0))
		} else {
			putFlatAOFromVertex(i2, extractAOFromVertex(i0), extractAOFromVertex(i1), extractAOFromVertex(i2), extractAOFromVertex(i3))
			putFlatAOFromVertex(i5, extractAOFromVertex(i3), extractAOFromVertex(i4), extractAOFromVertex(i5), extractAOFromVertex(i1))
		}
	}

	return {
		vertexes: new Uint32Array(vertexes),
		indices: new Uint32Array(indices),
	}
}

export const moveChunkMesh = (mesh: Mesh, offsetX: number, offsetY: number, offsetZ: number) => {
	const vertexes = mesh.vertexes
	const size = vertexes.length / FLOATS_PER_VERTEX | 0
	for (let i = 0; i < size; i++) {
		vertexes[i * FLOATS_PER_VERTEX] += offsetX
		vertexes[i * FLOATS_PER_VERTEX + 1] += offsetY
		vertexes[i * FLOATS_PER_VERTEX + 2] += offsetZ
	}
}

export const combineMeshes = (meshes: Mesh[]): Mesh => {
	const vertexes = []
	const indices = []
	for (const mesh of meshes) {
		const vertexesBeforeCount = vertexes.length / FLOATS_PER_VERTEX | 0
		for (const v of mesh.vertexes)
			vertexes.push(v)

		for (const v of mesh.indices)
			indices.push(v + vertexesBeforeCount)
	}

	return {
		vertexes: new Float32Array(vertexes),
		indices: new Uint32Array(indices),
	}
}
