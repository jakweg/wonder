import { Direction } from '../../util/direction'
import { ActivityId, requireActivity } from '../renderable/unit/activity'
import { UnitColorPaletteId } from '../renderable/unit/unit-color'
import { ItemType } from '../world/item'
import { World } from '../world/world'
import { GroundItemsIndex } from './ground-items-index'
import { PathFinder } from './path-finder'
import UnitsContainer from './units/units-container'


export const ACTIVITY_MEMORY_SIZE = 20

/** @deprecated */
export interface Unit {
	numericId: number
	posX: number
	posY: number
	posZ: number
	color: UnitColorPaletteId
	rotation: Direction
	activityId: ActivityId
	activityStartedAt: number
	activityMemory: Int32Array
	activityMemoryPointer: number
	interrupt: Int32Array
	heldItem: ItemType
}

export class GameState {
	private isRunningLogic: boolean = false

	private constructor(public readonly world: World,
	                    public readonly groundItems: GroundItemsIndex,
	                    public readonly units: UnitsContainer,
	                    public readonly pathFinder: PathFinder) {
	}

	private _currentTick: number = 0

	public get currentTick(): number {
		return this._currentTick | 0
	}

	public static createNew(
		world: World,
		groundItems: GroundItemsIndex,
		units: UnitsContainer,
		pathFinder: PathFinder): GameState {
		return new GameState(world, groundItems, units, pathFinder)
	}

	public advanceActivities() {
		if (this.isRunningLogic) throw new Error()
		this.isRunningLogic = true
		this._currentTick++

		this.pathFinder.tick(this)

		for (const unit of [...this._units]) {
			const activity = requireActivity(unit.activityId)

			// activity.perform(this, unit)
		}
		this.isRunningLogic = false
	}
}
