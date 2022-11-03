import * as building from './building'
import * as buildingRoot from './buildingRoot'
import * as idle from './idle'
import * as itemPickup from './item-pickup'
import * as itemPickupRoot from './item-pickup-root'
import * as miningResource from './mining-resource'
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
		default:
			return null
	}
}
