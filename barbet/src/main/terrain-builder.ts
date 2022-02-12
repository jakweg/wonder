import { makeNoise2D } from './util/noise/2d'

const getBlockTypeByNoiseValue = (v: number): BlockType => {
	if (v < 0.04)
		return BlockType.DeepWater

	if (v < 0.08)
		return BlockType.Water

	if (v < 0.20)
		return BlockType.Sand

	if (v < 0.50)
		return BlockType.Grass

	if (v < 0.70)
		return BlockType.Stone

	return BlockType.Snow
}

enum BlockType {
	Air = 0,
	Snow,
	Stone,
	Grass,
	Sand,
	Water,
	DeepWater,
}

const getTopColorByBlock = (block: BlockType): [number, number, number] => {
	switch (block) {
		case BlockType.Stone:
			return [0.415625, 0.41171875, 0.41171875]
		case BlockType.Grass:
			return [0.41015625, 0.73046875, 0.2578125]
		case BlockType.Sand:
			return [0.859375, 0.81640625, 0.6484375]
		case BlockType.Water:
			return [0.21875, 0.4921875, 0.9140625]
		case BlockType.DeepWater:
			return [0.21875, 0.3421875, 0.8140625]
		case BlockType.Snow:
		default:
			return [1, 1, 1]
	}
}

const getSideColorByBlock = (block: BlockType): [number, number, number] => {
	if (block === BlockType.Grass)
		return [0.39453125, 0.2890625, 0.20703125]
	if (block === BlockType.Snow)
		return getTopColorByBlock(BlockType.Stone)
	return getTopColorByBlock(block)
}

const randomizeColor = (color: [number, number, number]): [number, number, number] => {
	const r = Math.random() * 0.03 - 0.015
	return [color[0]! + r, color[1]! + r, color[2]! + r]
}

interface WorldSize {
	readonly sizeX: number,
	readonly sizeY: number,
	readonly sizeZ: number
}

export const generateWorld = ({sizeX, sizeY, sizeZ}: WorldSize): Uint8Array => {
	const world = new Uint8Array(sizeX * sizeY * sizeZ)
	world.fill(BlockType.Air)
	const noise = makeNoise2D(123)
	const borderSizeX = sizeX * 0.1 | 0
	const borderSizeZ = sizeZ * 0.1 | 0
	const borderSizeXSecond = sizeX - borderSizeX
	const borderSizeZSecond = sizeZ - borderSizeZ
	const centerX = sizeX / 2
	const centerZ = sizeZ / 2
	for (let j = 0; j < sizeZ; j++) {
		for (let k = 0; k < sizeX; k++) {
			const factor = 0.01
			let remappedNoiseValue = noise(j * factor, k * factor) * 0.5 + 0.5
			if (j < borderSizeZ)
				remappedNoiseValue = (j / borderSizeZ) ** (1 / 3) * remappedNoiseValue
			if (k < borderSizeX)
				remappedNoiseValue = (k / borderSizeX) ** (1 / 3) * remappedNoiseValue
			if (j > borderSizeZSecond)
				remappedNoiseValue = (1 - (j - borderSizeZSecond) / borderSizeZ) ** (1 / 3) * (remappedNoiseValue)
			if (k > borderSizeXSecond)
				remappedNoiseValue = (1 - (k - borderSizeXSecond) / borderSizeX) ** (1 / 3) * (remappedNoiseValue)

			const distanceToCenter = (1 - Math.sqrt(((centerX - k) / sizeX) ** 2 + ((centerZ - j) / sizeZ) ** 2)) ** 3
			let y = ((remappedNoiseValue ** (2 / 3)) * distanceToCenter * sizeY) | 0

			const block = getBlockTypeByNoiseValue(y / sizeY)
			world[y * sizeX * sizeZ + k * sizeZ + j] = block
			let blockToSet = BlockType.Stone

			if (block === BlockType.Water || block === BlockType.DeepWater) {
				blockToSet = block
				y = 5
			}

			for (let i = 0; i < y; i++) {
				world[i * sizeX * sizeZ + k * sizeZ + j] = blockToSet
			}
		}
	}
	return world
}

export const generateMeshData = (world: Uint8Array, size: WorldSize) => {
	const NO_ELEMENT_INDEX_MARKER = 4294967295
	const {sizeX, sizeY, sizeZ} = size
	const vertexIndexes = new Uint32Array((sizeX + 1) * (sizeY + 1) * (sizeZ + 1))
	vertexIndexes.fill(NO_ELEMENT_INDEX_MARKER)
	console.assert(vertexIndexes[0] === NO_ELEMENT_INDEX_MARKER)

	const vertexes: number[] = []
	const elements: number[] = []

	let addedVertexesCounter = 0

	const vertexesPerY = (sizeX + 1) * (sizeZ + 1)

	const vertexesPerX = (sizeZ + 1)
	const forceAddVertex = (positionIndex: number, x: number, y: number, z: number): number => {
		vertexes.push(x, y, z, 2, 2, 2, 0)
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

	const setColor = (vertexIndex: number,
	                  colorValue: [number, number, number],
	                  encodedNormal: number): number => {
		vertexIndex *= 7
		const wasNeverUsed = vertexes[vertexIndex + 3]! === 2 && vertexes[vertexIndex + 4]! === 2 && vertexes[vertexIndex + 5]! === 2
		if (!wasNeverUsed) {
			const x = vertexes[vertexIndex]!
			const y = vertexes[vertexIndex + 1]!
			const z = vertexes[vertexIndex + 2]!
			const positionIndex = y * vertexesPerY + x * vertexesPerX + z
			vertexIndex = forceAddVertex(positionIndex, x, y, z) * 7
		}
		vertexes[vertexIndex + 3] = colorValue[0]
		vertexes[vertexIndex + 4] = colorValue[1]
		vertexes[vertexIndex + 5] = colorValue[2]
		vertexes[vertexIndex + 6] = encodedNormal
		return vertexIndex / 7
	}

	for (let y = 0; y < sizeY; y++) {
		for (let z = 0; z < sizeZ; z++) {
			for (let x = 0; x < sizeX; x++) {
				const thisBlock = world[y * sizeX * sizeZ + x * sizeZ + z]! as BlockType
				if (thisBlock === BlockType.Air) continue

				const needsTop = y === sizeY - 1 || world[(y + 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockType === BlockType.Air
				// const needsBottom = y === 0 || world[(y - 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockType === BlockType.Air
				const needsBottom = false // disabled temporarily
				const needsPositiveZ = z === sizeZ - 1 || world[y * sizeX * sizeZ + x * sizeZ + (z + 1)]! as BlockType === BlockType.Air
				const needsNegativeZ = z === 0 || world[y * sizeX * sizeZ + x * sizeZ + (z - 1)]! as BlockType === BlockType.Air
				const needsPositiveX = x === sizeX - 1 || world[y * sizeX * sizeZ + (x + 1) * sizeZ + z]! as BlockType === BlockType.Air
				const needsNegativeX = x === 0 || world[y * sizeX * sizeZ + (x - 1) * sizeZ + z]! as BlockType === BlockType.Air

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

				if (needsTop) {
					const topColor = randomizeColor(getTopColorByBlock(thisBlock))
					e1 = setColor(e1, topColor, 0b011001)
					elements.push(
						e2, e3, e1,
						e3, e4, e1,
					)
				}

				// if (needsBottom) {
				// 	e5 = setColor(e5, topColor, 0b010001)
				// 	elements.push(
				// 		e7, e6, e5,
				// 		e8, e7, e5,
				// 	)
				// }

				const sideColor = randomizeColor(getSideColorByBlock(thisBlock))
				if (needsPositiveX) {
					e7 = setColor(e7, sideColor, 0b100101)
					elements.push(
						e4, e3, e7,
						e8, e4, e7,
					)
				}

				if (needsNegativeX) {
					e2 = setColor(e2, sideColor, 0b000101)
					elements.push(
						e1, e5, e2,
						e5, e6, e2,
					)
				}

				if (needsPositiveZ) {
					e3 = setColor(e3, sideColor, 0b010110)
					elements.push(
						e2, e6, e3,
						e6, e7, e3,
					)
				}

				if (needsNegativeZ) {
					e8 = setColor(e8, sideColor, 0b010100)
					elements.push(
						e1, e4, e8,
						e5, e1, e8,
					)
				}
			}
		}
	}

	return {
		vertexes,
		elements,
	}
}
