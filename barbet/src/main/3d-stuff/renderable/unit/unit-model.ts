import {
	FLAG_PART_FACE,
	FLAG_PART_LEFT_ARM,
	FLAG_PART_LEFT_LEG,
	FLAG_PART_MAIN_BODY,
	FLAG_PART_RIGHT_ARM,
	FLAG_PART_RIGHT_LEG,
	FLAG_POSITION_BOTTOM,
	FLAG_POSITION_MIDDLE,
	FLAG_POSITION_TOP,
	FLAG_PROVOKING_BOTTOM,
	FLAG_PROVOKING_TOP,
	MASK_BODY_PART,
	MASK_PROVOKING,
} from './unit-shaders'

export const buildUnitModel = () => {
	const basicPositions: number[] = [
		// MAIN BODY:
		0.5, -1, -0.5, 1, 1, 0, FLAG_PROVOKING_BOTTOM | FLAG_POSITION_BOTTOM | 0b010001, // bottom
		0.5, -1, 0.5, 0, 1, 0, FLAG_PROVOKING_BOTTOM | FLAG_POSITION_BOTTOM | 0b010100, // bottom front
		-0.5, -1, 0.5, 1, 1, 0, FLAG_PROVOKING_BOTTOM | FLAG_POSITION_BOTTOM | 0b100101, // bottom right side
		-0.5, -1, -0.5, 1, 1, 1, FLAG_PROVOKING_BOTTOM | FLAG_POSITION_BOTTOM,

		0.5, 0.2, -0.5, 1, 1, 1, FLAG_PROVOKING_TOP | FLAG_POSITION_MIDDLE,
		0.5, 0.2, 0.5, 1, 0, 1, FLAG_PROVOKING_TOP | FLAG_POSITION_MIDDLE | 0b010100, // top front
		-0.5, 0.2, 0.5, 1, 1, 0, FLAG_PROVOKING_BOTTOM | FLAG_POSITION_MIDDLE | 0b010110,// bottom back
		-0.5, 0.2, -0.5, 1, 1, 0, FLAG_PROVOKING_BOTTOM | FLAG_POSITION_MIDDLE | 0b000101,// bottom left side

		0.5, 1, -0.5, 0, 1, 1, FLAG_PROVOKING_TOP | FLAG_POSITION_TOP | 0b011001,// top
		0.5, 1, 0.5, 1, 1, 1, FLAG_PROVOKING_TOP | FLAG_POSITION_TOP | 0b100101,// top right side
		-0.5, 1, 0.5, 1, 1, 1, FLAG_PROVOKING_TOP | FLAG_POSITION_TOP | 0b010110,// top back
		-0.5, 1, -0.5, 1, 1, 1, FLAG_PROVOKING_TOP | FLAG_POSITION_TOP | 0b000101,// top left side
	]
	const basicElements: number[] = [
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
		3, 2, 6,
		7, 3, 6,

		// top front
		4, 8, 5,
		8, 9, 5,
		// top right side
		6, 5, 9,
		10, 6, 9,
		// top left side
		4, 7, 11,
		8, 4, 11,
		// top back
		7, 6, 10,
		11, 7, 10,

		// top
		10, 9, 8,
		11, 10, 8,
	]

	const VERTEX_SIZE = 7
	const basicPositionsLength = basicPositions.length / VERTEX_SIZE | 0
	const basicElementsLength = basicElements.length | 0
	const finalModelVertexData: number[] = []
	const finalModelElements: number[] = []

	const addBodyPart = (
		scaleX: number,
		scaleY: number,
		scaleZ: number,
		translateX: number,
		translateY: number,
		translateZ: number,
		bodyPart: number,
		flipProvoking: boolean) => {
		const start = finalModelVertexData.length / VERTEX_SIZE
		for (let i = 0; i < basicPositionsLength; i++) {
			const ii = i * VERTEX_SIZE
			let flags = (basicPositions[ii + 6]! & ~MASK_BODY_PART) | bodyPart
			if (flipProvoking) {
				if ((flags & MASK_PROVOKING) === FLAG_PROVOKING_TOP)
					flags = (flags & ~MASK_PROVOKING) | FLAG_PROVOKING_BOTTOM
				else if ((flags & MASK_PROVOKING) === FLAG_PROVOKING_BOTTOM)
					flags = (flags & ~MASK_PROVOKING) | FLAG_PROVOKING_TOP
			}
			finalModelVertexData.push(
				basicPositions[ii]! * scaleX + translateX, // x
				basicPositions[ii + 1]! * scaleY + translateY,// y
				basicPositions[ii + 2]! * scaleZ + translateZ, // z
				basicPositions[ii + 3]!, // r
				basicPositions[ii + 4]!, // g
				basicPositions[ii + 5]!, // b
				flags, // flags
			)
		}
		for (let i = 0; i < basicElementsLength; i++) {
			finalModelElements.push(basicElements[i]! + start)
		}
	}

	addBodyPart(1, 1, 1, 0, 0, 0, FLAG_PART_MAIN_BODY, false)

	addBodyPart(0.4, 0.4, 0.4, 0, -0.2, -0.68, FLAG_PART_LEFT_ARM, true)
	addBodyPart(0.4, 0.4, 0.4, 0, -0.2, 0.68, FLAG_PART_RIGHT_ARM, true)

	addBodyPart(0.3, 0.25, 0.3, 0, -1.28, 0.25, FLAG_PART_RIGHT_LEG, false)
	addBodyPart(0.3, 0.25, 0.3, 0, -1.28, -0.25, FLAG_PART_LEFT_LEG, false)

	const addFacePart = () => {
		// mouth
		let start = finalModelVertexData.length / VERTEX_SIZE | 0
		const xPosition = 0.51
		finalModelVertexData.push(
			xPosition, 0.50, 0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.44, 0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.44, -0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.50, -0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
		)
		finalModelElements.push(start, start + 1, start + 2)
		finalModelElements.push(start, start + 2, start + 3)

		// left eye
		start = finalModelVertexData.length / VERTEX_SIZE | 0
		finalModelVertexData.push(
			xPosition, 0.83, -0.20, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.76, -0.20, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.76, -0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.83, -0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
		)
		finalModelElements.push(start, start + 1, start + 2)
		finalModelElements.push(start, start + 2, start + 3)

		// right eye
		start = finalModelVertexData.length / VERTEX_SIZE | 0
		finalModelVertexData.push(
			xPosition, 0.83, 0.20, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.76, 0.20, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.76, 0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
			xPosition, 0.83, 0.26, 1, 1, 1, FLAG_PART_FACE | 0b010100,
		)
		finalModelElements.push(start, start + 2, start + 1)
		finalModelElements.push(start, start + 3, start + 2)

		// nose eye
		start = finalModelVertexData.length / VERTEX_SIZE | 0
		finalModelVertexData.push(
			xPosition * 1.2, 0.65, 0.00, 1, 1, 1, FLAG_PART_FACE,
			xPosition, 0.60, 0.10, 1, 1, 1, FLAG_PART_FACE,
			xPosition, 0.75, 0.00, 1, 1, 1, FLAG_PART_FACE,
			xPosition, 0.60, -0.10, 1, 1, 1, FLAG_PART_FACE,
		)
		finalModelElements.push(start, start + 2, start + 1)
		finalModelElements.push(start, start + 3, start + 2)
	}
	addFacePart()

	return {
		vertexes: new Float32Array(finalModelVertexData),
		elements: new Uint16Array(finalModelElements),
		trianglesToRender: finalModelElements.length | 0,
	}
}
