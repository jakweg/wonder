export const enum Direction {
	PositiveX,
	PositiveXNegativeZ,
	NegativeZ,
	NegativeXNegativeZ,
	NegativeX,
	NegativeXPositiveZ,
	PositiveZ,
	PositiveXPositiveZ,

	MaskMergePrevious = 0b1000000,
	MaskCurrentRotation = 0b0000111,
	MaskPreviousRotation = 0b0111000,
	FlagMergeWithPrevious = 0b1000000,
}

const rotationChanges = [
	[1, 0],
	[1, -1],
	[0, -1],
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, 1],
	[1, 1],
]
export const getChangeInXByRotation = (rotation: number): number => {
	const value = rotationChanges[rotation]
	if (value === undefined)
		throw new Error(`Invalid rotation given ${rotation}`)
	return value[0]!
}
export const getChangeInZByRotation = (rotation: number): number => {
	const value = rotationChanges[rotation]
	if (value === undefined)
		throw new Error(`Invalid rotation given ${rotation}`)
	return value[1]!
}
export const getRotationByChangeInCoords = (changeX: number, changeZ: number): Direction => {
	switch (changeX) {
		case -1:
			switch (changeZ) {
				case -1:
					return Direction.NegativeXNegativeZ
				case 0:
					return Direction.NegativeX
				case 1:
					return Direction.NegativeXPositiveZ
			}
			break
		case 0:
			switch (changeZ) {
				case -1:
					return Direction.NegativeZ
				case 1:
					return Direction.PositiveZ
			}
			break
		case 1:
			switch (changeZ) {
				case -1:
					return Direction.PositiveXNegativeZ
				case 0:
					return Direction.PositiveX
				case 1:
					return Direction.PositiveXPositiveZ
			}
			break
	}
	throw new Error(`Invalid coords change ${changeX} ${changeZ}`)
}
