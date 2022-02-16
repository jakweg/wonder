export const buildBoxModel = () => {
	const basicPositions: number[] = [
		// MAIN BODY:
		-0.5, -0.5, -0.5, 0b010001,
		0.5, -0.5, -0.5, 0b010100,
		0.5, -0.5, 0.5, 0b100101,
		-0.5, -0.5, 0.5, 0b010110,

		-0.5, 0.5, -0.5, 0,
		0.5, 0.5, -0.5, 0b101110,
		0.5, 0.5, 0.5, 0,
		-0.5, 0.5, 0.5, 0b000101,
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
		2, 6, 3,
		6, 7, 3,
		// top
		4, 7, 5,
		7, 6, 5,
	]

	return {
		vertexes: new Float32Array(basicPositions),
		elements: new Uint8Array(basicElements),
		trianglesToRender: basicElements.length | 0,
	}
}
