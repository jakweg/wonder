import { BlockId } from './block'
import { World } from './world'

export interface BoundingBox {
	minX: number
	maxX: number
	minY: number
	maxY: number
	minZ: number
	maxZ: number
}

function findMinY(rawBlockData: Uint8Array, blocksPerY: number,
                  sizeZ: number, boundingBox: BoundingBox): void {
	for (let y = boundingBox.minY; y < boundingBox.maxY; y++)
		for (let x = boundingBox.minX; x < boundingBox.maxX; x++)
			for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++) {
				const id = rawBlockData[y * blocksPerY + x * sizeZ + z] as BlockId
				if (id !== BlockId.Air) {
					boundingBox.minY = y
					return
				}
			}
}

function findMaxY(rawBlockData: Uint8Array, blocksPerY: number,
                  sizeZ: number, boundingBox: BoundingBox): void {
	for (let y = boundingBox.maxY - 1; y >= boundingBox.minY; y--)
		for (let x = boundingBox.minX; x < boundingBox.maxX; x++)
			for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++) {
				const id = rawBlockData[y * blocksPerY + x * sizeZ + z] as BlockId
				if (id !== BlockId.Air) {
					boundingBox.maxY = y + 1
					return
				}
			}
}

function findMinX(rawBlockData: Uint8Array, blocksPerY: number,
                  sizeZ: number, boundingBox: BoundingBox): void {
	for (let x = boundingBox.minX; x < boundingBox.maxX; x++)
		for (let y = boundingBox.minY; y < boundingBox.maxY; y++)
			for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++) {
				const id = rawBlockData[y * blocksPerY + x * sizeZ + z] as BlockId
				if (id !== BlockId.Air) {
					boundingBox.minX = x
					return
				}
			}
}

function findMaxX(rawBlockData: Uint8Array, blocksPerY: number,
                  sizeZ: number, boundingBox: BoundingBox): void {
	for (let x = boundingBox.maxX - 1; x >= boundingBox.minX; x--)
		for (let y = boundingBox.minY; y < boundingBox.maxY; y++)
			for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++) {
				const id = rawBlockData[y * blocksPerY + x * sizeZ + z] as BlockId
				if (id !== BlockId.Air) {
					boundingBox.maxX = x
					return
				}
			}
}

function findMinZ(rawBlockData: Uint8Array, blocksPerY: number,
                  sizeZ: number, boundingBox: BoundingBox): void {
	for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++)
		for (let y = boundingBox.minY; y < boundingBox.maxY; y++)
			for (let x = boundingBox.minX; x < boundingBox.maxX; x++) {
				const id = rawBlockData[y * blocksPerY + x * sizeZ + z] as BlockId
				if (id !== BlockId.Air) {
					boundingBox.minZ = z
					return
				}
			}
}

function findMaxZ(rawBlockData: Uint8Array, blocksPerY: number,
                  sizeZ: number, boundingBox: BoundingBox): void {
	for (let z = boundingBox.maxZ - 1; z >= boundingBox.minZ; z--)
		for (let y = boundingBox.minY; y < boundingBox.maxY; y++)
			for (let x = boundingBox.minX; x < boundingBox.maxX; x++) {
				const id = rawBlockData[y * blocksPerY + x * sizeZ + z] as BlockId
				if (id !== BlockId.Air) {
					boundingBox.maxZ = z
					return
				}
			}
}


export const computeWorldBoundingBox = (of: World): BoundingBox => {
	const {blocksPerY, sizeX, sizeY, sizeZ} = of.size
	let rawBlockData = of.rawBlockData

	const boundingBox: BoundingBox = {
		minX: 0, maxX: sizeX,
		minY: 0, maxY: sizeY,
		minZ: 0, maxZ: sizeZ,
	}

	findMinX(rawBlockData, blocksPerY, sizeZ, boundingBox)
	findMaxX(rawBlockData, blocksPerY, sizeZ, boundingBox)
	findMinZ(rawBlockData, blocksPerY, sizeZ, boundingBox)
	findMaxZ(rawBlockData, blocksPerY, sizeZ, boundingBox)
	findMinY(rawBlockData, blocksPerY, sizeZ, boundingBox)
	findMaxY(rawBlockData, blocksPerY, sizeZ, boundingBox)

	return boundingBox
}
