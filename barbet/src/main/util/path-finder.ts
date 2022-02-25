import SortedList from './sorted-list'


/**
 * Checks if node is walkable
 * Must return true if node exists and is walkable
 * Must return false otherwise
 */
export type WalkableTester = ((x: number, y: number) => boolean)

/**
 * Simple entity that represents point in 2D
 */
export interface Position {
	x: number
	y: number
}

export const enum Direction {
	PositiveX,
	PositiveXNegativeZ,
	NegativeZ,
	NegativeXNegativeZ,
	NegativeX,
	NegativeXPositiveZ,
	PositiveZ,
	PositiveXPositiveZ,
}

interface Node extends Position {
	/**
	 * Distance from starting node
	 */
	costG: number
	/**
	 * Distance from end node (heuristic)
	 */
	costH: number
	/**
	 * costG + costH
	 */
	costF: number
	parent?: Node
	directionToGetFromParent?: Direction
}

/**
 * Finds the path between two points
 * Always finds a full path
 * Returns list of directions or null if failed to find a path
 * @param sx x coordinate of start
 * @param sy y coordinate of start
 * @param dx x coordinate of destination
 * @param dy y coordinate of destination
 * @param tester callback which will be executed to check if tile is walkable or not
 * @returns list of directions between points start and destination, returns null if failed to determine path
 */
export const findPathDirectionsExact = (sx: number, sy: number,
                                        dx: number, dy: number,
                                        tester: WalkableTester): Direction[] | null => {

	const calculateCost = (x1: number, y1: number,
	                       x2: number, y2: number): number => {
		// return (Math.abs(x1 - x2) + Math.abs(y1 - y2)) * 10
		const offsetX = Math.abs(x1 - x2)
		const offsetY = Math.abs(y1 - y2)
		const nonDiagonalMoves = Math.abs(offsetX - offsetY)
		return nonDiagonalMoves * 10 + Math.min(offsetX, offsetY) * 14
	}

	const calculateCostG = (x: number, y: number) => calculateCost(x, y, sx, sy)
	const calculateCostH = (x: number, y: number) => calculateCost(x, y, dx, dy)

	const createNode = (x: number, y: number, dir?: Direction): Node => {
		const costG = calculateCostG(x, y)
		const costH = calculateCostH(x, y)
		return {
			x, y, costH, costG,
			costF: costG + costH,
			directionToGetFromParent: dir,
		}
	}


	const fCostComparator = (o1: Node, o2: Node) => o1.costF < o2.costF

	const openNodes: SortedList<Node> = new SortedList<Node>(fCostComparator)
	const closedNodes: Set<number> = new Set<number>()

	const calculateSetKey = (x: number, y: number): number => x << 16 | y

	const executeWithWalkableNeighboursNotInClosed = (x: number, y: number, callback: (n: Node) => void) => {
		const walkable1 = tester(x - 1, y)
		const walkable2 = tester(x, y - 1)
		const walkable3 = tester(x + 1, y)
		const walkable4 = tester(x, y + 1)

		if (walkable1 && !closedNodes.has(calculateSetKey(x - 1, y)))
			callback(createNode(x - 1, y, Direction.NegativeX))

		if (walkable2 && !closedNodes.has(calculateSetKey(x, y - 1)))
			callback(createNode(x, y - 1, Direction.NegativeZ))

		if (walkable3 && !closedNodes.has(calculateSetKey(x + 1, y)))
			callback(createNode(x + 1, y, Direction.PositiveX))

		if (walkable4 && !closedNodes.has(calculateSetKey(x, y + 1)))
			callback(createNode(x, y + 1, Direction.PositiveZ))


		if (walkable1 && walkable2 && tester(x - 1, y - 1) && !closedNodes.has(calculateSetKey(x - 1, y - 1)))
			callback(createNode(x - 1, y - 1, Direction.NegativeXNegativeZ))

		if (walkable1 && walkable4 && tester(x - 1, y + 1) && !closedNodes.has(calculateSetKey(x - 1, y + 1)))
			callback(createNode(x - 1, y + 1, Direction.NegativeXPositiveZ))

		if (walkable3 && walkable2 && tester(x + 1, y - 1) && !closedNodes.has(calculateSetKey(x + 1, y - 1)))
			callback(createNode(x + 1, y - 1, Direction.PositiveXNegativeZ))

		if (walkable3 && walkable4 && tester(x + 1, y + 1) && !closedNodes.has(calculateSetKey(x + 1, y + 1)))
			callback(createNode(x + 1, y + 1, Direction.PositiveXPositiveZ))

	}

	openNodes.add(createNode(sx, sy))

	while (true) {
		const current = openNodes.getAndRemoveFirst()
		if (!current) {
			// unable to find path :/
			return null
		}

		if (current.x === dx && current.y === dy) {
			// found path!
			const stack: Direction[] = []
			let tmp: Node | undefined = current
			while (tmp != null) {
				stack.unshift(tmp.directionToGetFromParent!)
				tmp = tmp.parent
			}
			stack.shift()
			return stack
		}

		closedNodes.add(calculateSetKey(current.x, current.y))

		executeWithWalkableNeighboursNotInClosed(current.x, current.y, (neighbour) => {
			if (!openNodes.has(e => e.x === neighbour.x && e.y === neighbour.y)) {
				neighbour.parent = current
				openNodes.add(neighbour)
			}
		})

	}
}
