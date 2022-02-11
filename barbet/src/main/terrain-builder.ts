/**
 * x, y, z, r, g, b
 */


type Vertex = [number, number, number, number, number, number]

const determineColorByNoiseValue = (v: number): [number, number, number] => {
	if (v < 0.10) // deep water
		return [0.1953125, 0.35546875, 0.60546875]

	if (v < 0.20) // water
		return [0.21875, 0.4921875, 0.9140625]

	if (v < 0.30) // sand
		return [0.859375, 0.81640625, 0.6484375]

	if (v < 0.70) // grass
		return [0.41015625, 0.73046875, 0.2578125]

	if (v < 0.90) // stone
		return [0.515625, 0.51171875, 0.51171875]

	// snow
	return [1, 1, 1]
}

enum BlockType {
	None = 0,
	Stone,
	Grass,
	Sand,
	Water,
	RED,
	PURPLE,
}

const getColorByBlock = (block: BlockType): [number, number, number] => {
	switch (block) {
		case BlockType.Stone:
			return [0.415625, 0.41171875, 0.41171875]
		case BlockType.Grass:
			return [0.41015625, 0.73046875, 0.2578125]
		case BlockType.Sand:
			return [0.859375, 0.81640625, 0.6484375]
		case BlockType.Water:
			return [0.21875, 0.4921875, 0.9140625]
		case BlockType.RED:
			return [1, 0, 0]
		case BlockType.PURPLE:
			return [1, 0, 1]
		default:
			return [1, 1, 1]
	}
}

interface WorldSize {
	readonly sizeX: number,
	readonly sizeY: number,
	readonly sizeZ: number
}

export const generateWorld = ({sizeX, sizeY, sizeZ}: WorldSize): Uint8Array => {
	const world = new Uint8Array(sizeX * sizeY * sizeZ)
	let index = 0
	for (let i = 0; i < sizeY; i++) {
		for (let j = 0; j < sizeZ; j++) {
			for (let k = 0; k < sizeX; k++) {
				// if (Math.sqrt(j * j + k * k) < 10)
				// world[index++] = BlockType.Stone
				// else
				// 	world[index++] = BlockType.None
				world[index++] = (Math.random() * 5 | 0) + 1
			}
		}
	}
	world[0] = BlockType.Sand
	world[7] = BlockType.Sand
	world[5] = BlockType.Water
	world[4] = BlockType.Grass
	world[2] = BlockType.RED
	world[3] = BlockType.PURPLE
	return world
}

export const generateMeshData = (world: Uint8Array, size: WorldSize) => {
	const NO_ELEMENT_INDEX_MARKER = 4294967295
	const {sizeX, sizeY, sizeZ} = size
	const vertexIndexes = new Uint32Array((sizeX + 1) * (sizeY + 1) * (sizeZ + 1))
	vertexIndexes.fill(NO_ELEMENT_INDEX_MARKER)
	console.assert(vertexIndexes[0] === NO_ELEMENT_INDEX_MARKER)

	const vertexes: Vertex[] = []
	const elements: number[] = []

	let addedVertexesCounter = 0

	const vertexesPerY = (sizeX + 1) * (sizeZ + 1)

	const vertexesPerX = (sizeZ + 1)
	const forceAddVertex = (positionIndex: number, x: number, y: number, z: number): number => {
		vertexes.push([x, y, z, 2, 2, 2])
		vertexIndexes[positionIndex] = addedVertexesCounter
		return addedVertexesCounter++
	}
	const addVertexIfNotExists = (x: number, y: number, z: number): number => {
		const positionIndex = y * vertexesPerY + x * vertexesPerX + z
		const elementIndex = vertexIndexes[positionIndex]!
		if (elementIndex === NO_ELEMENT_INDEX_MARKER) {
			return forceAddVertex(positionIndex, x, y, z)
		}
		return elementIndex
	}
	const setColor = (vertexIndex: number, value: [number, number, number]): number => {
		const wasNeverUsed = vertexes[vertexIndex]![3] === 2 && vertexes[vertexIndex]![4] === 2 && vertexes[vertexIndex]![5] === 2
		if (!wasNeverUsed) {
			const x = vertexes[vertexIndex]![0]
			const y = vertexes[vertexIndex]![1]
			const z = vertexes[vertexIndex]![2]
			const positionIndex = y * vertexesPerY + x * vertexesPerX + z
			vertexIndex = forceAddVertex(positionIndex, x, y, z)
		}
		vertexes[vertexIndex]![3] = value[0]
		vertexes[vertexIndex]![4] = value[1]
		vertexes[vertexIndex]![5] = value[2]
		return vertexIndex
	}
	let blockIndex = 0
	for (let y = 0; y < sizeY; y++) {
		for (let z = 0; z < sizeZ; z++) {
			for (let x = 0; x < sizeX; x++) {
				const thisBlock = world[blockIndex++]! as BlockType
				if (thisBlock === BlockType.None) continue

				const color = getColorByBlock(thisBlock)

				const needsTop = y === sizeY - 1 || world[(y + 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockType === BlockType.None
				const needsBottom = y === 0 || world[(y - 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockType === BlockType.None
				const needsPositiveZ = z === sizeZ - 1 || world[y * sizeX * sizeZ + x * sizeZ + (z + 1)]! as BlockType === BlockType.None
				const needsNegativeZ = z === 0 || world[y * sizeX * sizeZ + x * sizeZ + (z - 1)]! as BlockType === BlockType.None
				const needsPositiveX = x === sizeX - 1 || world[y * sizeX * sizeZ + (x + 1) * sizeZ + z]! as BlockType === BlockType.None
				const needsNegativeX = x === 0 || world[y * sizeX * sizeZ + (x - 1) * sizeZ + z]! as BlockType === BlockType.None

				if (!(needsTop || needsBottom || needsPositiveZ || needsNegativeZ || needsPositiveX || needsNegativeX)) continue

				let e1 = addVertexIfNotExists(x, y + 1, z)
				let e2 = addVertexIfNotExists(x, y + 1, z + 1)
				let e3 = addVertexIfNotExists(x + 1, y + 1, z + 1)
				let e4 = addVertexIfNotExists(x + 1, y + 1, z)

				let e5 = addVertexIfNotExists(x, y, z)
				let e6 = addVertexIfNotExists(x, y, z + 1)
				let e7 = addVertexIfNotExists(x + 1, y, z + 1)
				let e8 = addVertexIfNotExists(x + 1, y, z)

				if (needsTop) {
					e1 = setColor(e1, color)
					elements.push(
						e2, e3, e1,
						e3, e4, e1,
					)
				}

				if (needsBottom) {
					e5 = setColor(e5, color)
					elements.push(
						e7, e6, e5,
						e8, e7, e5,
					)
				}

				if (needsPositiveX) {
					e7 = setColor(e7, color)
					elements.push(
						e4, e3, e7,
						e8, e4, e7,
					)
				}

				if (needsNegativeX) {
					e2 = setColor(e2, color)
					elements.push(
						e1, e5, e2,
						e5, e6, e2,
					)
				}

				if (needsPositiveZ) {
					e3 = setColor(e3, color)
					elements.push(
						e2, e6, e3,
						e6, e7, e3,
					)
				}

				if (needsNegativeZ) {
					e8 = setColor(e8, color)
					elements.push(
						e1, e4, e8,
						e5, e1, e8,
					)
				}
			}
		}
	}

	return {
		vertexes: vertexes.map(e => [...e]),
		elements,
	}
}

const generateHeightMap = (sizeX: number, sizeZ: number): number[] => {
	const map: number[] = []
	for (let y = 0; y <= sizeZ; ++y) {
		for (let x = 0; x <= sizeX; ++x) {
			if (y % 3 === 0 && x % 3 === 0)
				map.push(1)
			else
				map.push(0)
		}
	}
	return map
}

export const buildVertexData = (sizeX: number, sizeZ: number): { vertexes: Vertex[], elements: number[] } => {
	const size = {sizeX, sizeY: sizeX, sizeZ}
	// @ts-ignore
	return generateMeshData(generateWorld(size), size)
	// const vertexes: Vertex[] = []
	// const elements: number[] = []

	// const world = generateHeightMap(sizeX, sizeZ)


	// for (let z = 0; z < sizeZ; ++z) {
	// 	for (let x = 0; x < sizeX; ++x) {
	// 		const y = world[z * sizeX + x]!
	// 		if (x === 0) {
	// 			// first on the left
	// 			if (z === 0) {
	// 				// first at the top
	// 				const currentIndex = vertexes.length
	// 				vertexes.push([x, y, z, 1, 1, 1]) // provoking vertex
	// 				vertexes.push([x, y, z + 1, 1, 1, 1])
	// 				vertexes.push([x + 1, y, z + 1, 1, 1, 1])
	// 				vertexes.push([x + 1, y, z, 1, 1, 1])
	//
	// 				elements.push(
	// 					currentIndex + 1, currentIndex + 2, currentIndex,
	// 					currentIndex + 2, currentIndex + 3, currentIndex,
	// 				)
	// 			}
	// 		} else {
	// 			if (z === 0) {
	// 				// first at the top
	//
	// 				if (y !== world[z * sizeX + (x - 1)]!) {
	// 					// place vertical plane
	// 					const currentIndex = vertexes.length
	// 					vertexes.push([x, y, z, Math.random(), 1, 1]) // provoking vertex
	// 					vertexes.push([x, y, z + 1, 1, 1, 1])
	// 					vertexes.push([x + 1, y, z + 1, 1, 1, 1])
	// 					vertexes.push([x + 1, y, z, 1, 1, 1])
	//
	// 					elements.push(
	// 						currentIndex + 1, currentIndex + 2, currentIndex,
	// 						currentIndex + 2, currentIndex + 3, currentIndex,
	// 					)
	// 				}
	//
	// 				const currentIndex = vertexes.length
	// 				vertexes.push([x, y, z, Math.random(), 1, 1]) // provoking vertex
	// 				vertexes.push([x, y, z + 1, 1, 1, 1])
	// 				vertexes.push([x + 1, y, z + 1, 1, 1, 1])
	// 				vertexes.push([x + 1, y, z, 1, 1, 1])
	//
	// 				elements.push(
	// 					currentIndex + 1, currentIndex + 2, currentIndex,
	// 					currentIndex + 2, currentIndex + 3, currentIndex,
	// 				)
	// 			}
	// 		}
	//
	// 		// vertexes.push([x, z, 1, 1, 1])
	// 	}
	// }

	// for (let y = 0; y <= sizeZ; ++y) {
	// 	for (let x = 0; x <= sizeX; ++x) {
	// 		vertexes.push([x, 1, y, 1, 1, 1])
	// 	}
	// }
	//
	//
	// const vertexesInRow = sizeX + 1
	// for (let y = 0; y < sizeZ; ++y) {
	// 	for (let x = 0; x < sizeX; ++x) {
	// 		elements.push(
	// 			(y + 1) * vertexesInRow + x,
	// 			(y + 1) * vertexesInRow + 1 + x,
	// 			y * vertexesInRow + x,
	//
	// 			(y + 1) * vertexesInRow + 1 + x,
	// 			y * vertexesInRow + x + 1,
	// 			y * vertexesInRow + x,
	// 		)
	// 	}
	// }

	// return {
	// 	vertexes,
	// 	elements,
	// }
}
