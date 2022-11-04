import * as building from './building'
import * as buildingRoot from './buildingRoot'
import * as idle from './idle'
import * as itemPickup from './item-pickup'
import * as itemPickupRoot from './item-pickup-root'
import * as miningResource from './mining-resource'
import * as slime_idle from './slime/idle'
import * as slime_jump from './slime/jump'
import * as slime_slowRotate from './slime/slow-rotate'
import * as walking from './walking'
import * as walkingByPathRoot from './walking-by-path-root'

export const enum ActivityId {
	None,
	Idle,
	WalkingByPathRoot,
	Walking,
	ItemPickUpRoot,
	ItemPickUp,
	MiningResource,
	BuildingRoot,
	Building,

	Slime_Idle,
	Slime_SlowRotate,
	Slime_Jump,
}

export const getActivityPerformFunction = (id: ActivityId) => {
	switch (id) {
		case ActivityId.Idle:
			return idle.perform
		case ActivityId.WalkingByPathRoot:
			return walkingByPathRoot.perform
		case ActivityId.Walking:
			return walking.perform
		case ActivityId.ItemPickUpRoot:
			return itemPickupRoot.perform
		case ActivityId.ItemPickUp:
			return itemPickup.perform
		case ActivityId.MiningResource:
			return miningResource.perform
		case ActivityId.BuildingRoot:
			return buildingRoot.perform
		case ActivityId.Building:
			return building.perform

		case ActivityId.Slime_Idle:
			return slime_idle.perform
		case ActivityId.Slime_SlowRotate:
			return slime_slowRotate.perform
		case ActivityId.Slime_Jump:
			return slime_jump.perform

		default:
			return null
	}
}
