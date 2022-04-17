import floatingTriangle from '../../3d-stuff/additional-renderables/floating-triangle'
import hammer from '../../3d-stuff/additional-renderables/hammer'
import { MainRenderer } from '../../3d-stuff/main-renderer'
import { RenderContext } from '../../3d-stuff/renderable/render-context'
import { ShaderId } from '../../3d-stuff/renderable/unit/shaders'
import { EntityTraitIndicesRecord } from '../entities/traits'
import { GameState } from '../game-state'
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

export interface AdditionalRenderer<T = any, B = any> {
	setup(renderer: MainRenderer, game: GameState): T

	prepareBatch(setup: T, ctx: RenderContext): B

	appendToBatch(setup: T, batch: B, unit: EntityTraitIndicesRecord): void

	executeBatch(setup: T, ctx: RenderContext, batch: B): void
}

export const getShaderIdForUnitByActivity = (id: ActivityId): ShaderId => {
	switch (id) {
		case ActivityId.Walking:
			return ShaderId.Walking

		case ActivityId.ItemPickUp:
			return ShaderId.PickUpItem

		case ActivityId.Building:
		case ActivityId.MiningResource:
			return ShaderId.MiningResource

		case ActivityId.BuildingRoot:
		case ActivityId.ItemPickUpRoot:
		case ActivityId.WalkingByPathRoot:
		case ActivityId.Idle:
			return ShaderId.Idle

		case ActivityId.None:
		default:
			return ShaderId.Stationary
	}
}

export const getAdditionalRendererByActivity = (id: ActivityId): AdditionalRenderer | null => {
	switch (id) {
		case ActivityId.Idle:
			return floatingTriangle
		case ActivityId.MiningResource:
		case ActivityId.Building:
			return hammer
		default:
			return null
	}
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
