import { GameState } from '../game-state/game-state'
import { MainRenderer } from '../main-renderer'
import { createPicker } from '../mouse-picker'
import createNewBuildingRenderable from './building/building-renderable'
import createHeldItemRenderable from './held-item/held-item'
import createNewItemOnGroundRenderable from './item-on-ground/item-on-ground'
import { RenderContext } from './render-context'
import { createNewSurfaceResourcesRenderable } from './surface-resources/resource'
import { createNewTerrainRenderable } from './terrain/terrain'
import { createNewUnitRenderable } from './unit/unit'

export const createCombinedRenderable = (renderer: MainRenderer, state: GameState) => {
	const units = createNewUnitRenderable(renderer, state)
	const terrain = createNewTerrainRenderable(renderer, state.world)
	const groundItems = createNewItemOnGroundRenderable(renderer, state)
	const heldItems = createHeldItemRenderable(renderer, state)
	const resources = createNewSurfaceResourcesRenderable(renderer, state)
	const buildings = createNewBuildingRenderable(renderer, state)
	const mousePicker = createPicker(renderer.rawContext, [terrain.renderForMousePicker, units.renderForMousePicker])

	return {
		mousePicker,
		render(ctx: RenderContext) {
			terrain.render(ctx)
			units.render(ctx)
			groundItems.render(ctx)
			heldItems.render(ctx)
			resources.render(ctx)
			buildings.render(ctx)
		},
	}
}
