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
	const closedNodes: SortedList<Node> = new SortedList<Node>(fCostComparator)


	const executeWithWalkableNeighboursNotInClosed = (x: number, y: number, callback: (n: Node) => void) => {
		x--
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.NegativeX))
		y--
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.NegativeXNegativeZ))
		x++
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.NegativeZ))
		x++
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.PositiveXNegativeZ))
		y++
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.PositiveX))
		y++
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.PositiveXPositiveZ))
		x--
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.PositiveZ))
		x--
		if (tester(x, y) && !closedNodes.has(n => x === n.x && y === n.y))
			callback(createNode(x, y, Direction.NegativeXPositiveZ))
	}

	openNodes.add(createNode(sx, sy))

	while (true) {
		const current = openNodes.getAndRemoveFirst()
		if (!current) {
			// unable to find path :/
			return null
		}
		closedNodes.add(current)

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

		executeWithWalkableNeighboursNotInClosed(current.x, current.y, (neighbour) => {
			if (!openNodes.has(e => e.x === neighbour.x && e.y === neighbour.y)) {
				neighbour.parent = current
				openNodes.add(neighbour)
			}
		})

	}
}
