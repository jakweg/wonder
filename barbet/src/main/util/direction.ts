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
