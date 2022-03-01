import { Direction, getChangeInXByRotation, getChangeInZByRotation } from '../../../util/direction'
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
	ActivityFinishTick,
	Direction,
}

const MEMORY_USED_SIZE = 2

const activityItemPickup = {
	numericId: ActivityId.ItemPickUp,
	shaderId: ShaderId.PickUpItem,
	perform(game: GameState, unit: Unit) {
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer

		const finishAt = memory[pointer - MemoryField.ActivityFinishTick]!
		if (game.currentTick !== finishAt) return
		const direction = memory[pointer - MemoryField.Direction]! as Direction

		const itemX = unit.posX + getChangeInXByRotation(direction)
		const itemZ = unit.posZ + getChangeInZByRotation(direction)

		unit.heldItem = game.groundItems.getItem(itemX, itemZ)
		game.groundItems.setItem(itemX, itemZ, ItemType.None)

		unit.rotation &= ~Direction.MaskMergePrevious
		unit.activityMemoryPointer -= MEMORY_USED_SIZE
		activityItemPickupRoot.onPickedUp(game, unit)
	},
	setup(game: GameState, unit: Unit, direction: Direction) {
		const now = game.currentTick
		const memory = unit.activityMemory
		const pointer = unit.activityMemoryPointer = unit.activityMemoryPointer + MEMORY_USED_SIZE

		unit.rotation = Direction.FlagMergeWithPrevious | ((unit.rotation & Direction.MaskCurrentRotation) << 3) | direction
		unit.activityId = ActivityId.ItemPickUp
		unit.activityStartedAt = now

		memory[pointer - MemoryField.ActivityFinishTick] = now + pickUpItemActivityDuration
		memory[pointer - MemoryField.Direction] = direction
	},
}

export default activityItemPickup
