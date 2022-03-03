import { GameState } from '../game-state/game-state'
import { MainRenderer } from '../main-renderer'
import { createPicker } from '../mouse-picker'
import createHeldItemRenderable from './held-item/held-item'
import createNewItemOnGroundRenderable from './item-on-ground/item-on-ground'
import { RenderContext } from './render-context'
import { createNewTerrainRenderable } from './terrain/terrain'
import { createNewUnitRenderable } from './unit/unit'

export const createCombinedRenderable = (renderer: MainRenderer, state: GameState) => {
	const units = createNewUnitRenderable(renderer, state)
	const terrain = createNewTerrainRenderable(renderer, state.world)
	const groundItems = createNewItemOnGroundRenderable(renderer, state)
	const heldItems = createHeldItemRenderable(renderer, state)
	const mousePicker = createPicker(renderer.rawContext, [terrain.renderForMousePicker, units.renderForMousePicker])

	return {
		mousePicker,
		render(ctx: RenderContext) {
			terrain.render(ctx)
			units.render(ctx)
			groundItems.render(ctx)
			heldItems.render(ctx)
		},
		renderForMousePicker(ctx: RenderContext) {
			terrain.renderForMousePicker(ctx)
			units.renderForMousePicker(ctx)
		},
	}
}
