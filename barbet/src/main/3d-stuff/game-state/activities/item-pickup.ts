import { ActivityId } from '../../renderable/unit/activity'
import { ShaderId } from '../../renderable/unit/unit-shaders'
import { ItemType } from '../../world/item'
import { GameState, Unit } from '../game-state'
import activityItemPickupRoot from './item-pickup-root'

const pickUpItemActivityDuration = 10

export const itemPickUpTransformationsSource = () => `
float usedSin = sin(activityDuration / PI / 1.0);
if (isMainBodyVertex && isTopVertex) {
	pos.x += usedSin * (pos.y + 0.05) * 0.8;
	pos.y -= usedSin * pos.x * 0.2;
}
if (isFaceVertex) {
	pos.x += usedSin * (pos.y + 1.1) * 0.35;
	pos.y -= usedSin * pos.y * 0.45;
}
if (isMainBodyVertex && isMiddleVertex) {
	pos.x += usedSin * (pos.y + 0.01) * 1.6;
	pos.y -= usedSin * pos.x * 0.2;
}
if (isLeftArmVertex || isRightArmVertex) {
	bool isPhaseOne = activityDuration < 5.0; 
	if (isPhaseOne)
		pos.x += usedSin * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9;
	else
		pos.x += sin(5.0 / PI / 1.0) * (pos.y + (isBottomVertex ? 1.9 : (isMiddleVertex ? 0.85 : 0.4))) * 0.9 - cos(activityDuration / PI / 1.0) * -0.5;
	pos.y -= usedSin * 0.4;
}
`

const enum MemoryField {
	WalkingFinishTick
}

const MEMORY_USED_SIZE = 1

const activityItemPickup = {
	numericId: ActivityId.ItemPickUp,
	shaderId: ShaderId.PickUpItem,
	perform(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

		const finishAt = memory[pointer - MemoryField.WalkingFinishTick]!
		if (game.currentTick !== finishAt) return

		unit.heldItem = ItemType.Box
		unit.activityMemoryPointer -= MEMORY_USED_SIZE
		activityItemPickupRoot.onPickedUp(game, unit)
	},
	setup(game: GameState, unit: Unit) {
		const now = game.currentTick
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer = unit.activityMemoryPointer + MEMORY_USED_SIZE

		unit.activityId = ActivityId.ItemPickUp
		unit.activityStartedAt = now

		memory[pointer - MemoryField.WalkingFinishTick] = now + pickUpItemActivityDuration
	},
}

export default activityItemPickup
