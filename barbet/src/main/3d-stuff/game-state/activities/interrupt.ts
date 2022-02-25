export const enum InterruptType {
	/**
	 * No interruption happened, doesn't hold any additional data
	 */
	None,
	/**
	 * Player requested the unit to walk, data is x, z of tile requested to go to
	 */
	WalkRequest
}

