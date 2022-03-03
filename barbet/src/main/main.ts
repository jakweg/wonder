import { interruptRequestItemPickUp, interruptRequestWalk } from './3d-stuff/game-state/activities/interrupt'
import { getEntityById_drawableItem, iterateOverAllSelectedEntities } from './3d-stuff/game-state/entities/queries'
import { DataOffsetDrawables, DataOffsetItemHoldable } from './3d-stuff/game-state/entities/traits'
import { GameState } from './3d-stuff/game-state/game-state'
import { stateUpdaterFromReceived } from './3d-stuff/game-state/state-updater'
import { MainRenderer } from './3d-stuff/main-renderer'
import { createPicker, MousePickableType } from './3d-stuff/mouse-picker'
import createHeldItemRenderable from './3d-stuff/renderable/held-item/held-item'
import createNewItemOnGroundRenderable from './3d-stuff/renderable/item-on-ground/item-on-ground'
import { RenderContext } from './3d-stuff/renderable/render-context'
import { createNewTerrainRenderable } from './3d-stuff/renderable/terrain/terrain'
import { createNewUnitRenderable } from './3d-stuff/renderable/unit/unit'
import { UnitColorPaletteId } from './3d-stuff/renderable/unit/unit-color'
import { BlockId } from './3d-stuff/world/block'
import { ItemType } from './3d-stuff/world/item'
import { Camera } from './camera'
import KEYBOARD from './keyboard-controller'
import * as vec3 from './util/matrix/vec3'
import { Lock } from './util/mutex'
import { Connection, setMessageHandler } from './worker/message-handler'
import { UpdateWorkerController } from './worker/update-worker-controller'
import { globalMutex } from './worker/worker-global-state'


const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const renderer = MainRenderer.fromHTMLCanvas(canvas)
const camera = Camera.newPerspective(90, 1280 / 720)
camera.moveCamera(9.5, 0, 7)

interface GameFrontendStuff {
	workerStartDelay: number,
	state: GameState,
	updater: ReturnType<typeof stateUpdaterFromReceived>
	terrain: ReturnType<typeof createNewTerrainRenderable>,
	units: ReturnType<typeof createNewUnitRenderable>
	heldItems: ReturnType<typeof createHeldItemRenderable>,
	groundItems: ReturnType<typeof createNewItemOnGroundRenderable>,
	mousePicker: ReturnType<typeof createPicker>
}

let stuff: GameFrontendStuff | null = null

const sunPosition = vec3.fromValues(-500, 500, -500)

const firstRenderTime = performance.now()
let fixedTime: number | null = null
document.getElementById('input-u_time')
	?.addEventListener('input', (event) => {
		fixedTime = +(event.target as HTMLInputElement).value
	})

let speedToSet = 20
document.getElementById('input-ticksPerSecond')
	?.addEventListener('input', async (event) => {
		speedToSet = +(event.target as HTMLInputElement).value
		// if (await updater.stop() === 'stopped') {
		// 	updater.start(speedToSet)
		// }
	})

let lastContext: RenderContext | null = null
renderer.renderFunction = async (gl, dt) => {
	await globalMutex.executeWithAcquiredAsync(Lock.Update, () => {
		renderer.renderStarted()

		const now = performance.now()
		const nowStuff = stuff
		if (nowStuff === null) return

		const ctx: RenderContext = {
			gl,
			camera,
			sunPosition,
			gameTickEstimation: nowStuff.updater.estimateCurrentGameTickTime(nowStuff.workerStartDelay),
			secondsSinceFirstRender: fixedTime ?? (now - firstRenderTime) / 1000,
		}
		lastContext = ctx
		moveCameraByKeys(camera, dt)
		camera.updateMatrixIfNeeded()
		Object.freeze(ctx)

		const r = 200
		// sunPosition[0] = Math.cos(ctx.secondsSinceFirstRender) * r + 10
		// sunPosition[2] = Math.sin(ctx.secondsSinceFirstRender) * r + 10
		sunPosition[0] = Math.cos(1) * r + 10
		sunPosition[2] = Math.sin(1) * r + 10

		nowStuff.terrain.render(ctx)
		nowStuff.units.render(ctx)
		nowStuff.heldItems.render(ctx)
		nowStuff.groundItems.render(ctx)
	})
}

const mouseEventListener = async (event: MouseEvent) => {
	event.preventDefault()
	const ctx = lastContext
	if (!ctx) return
	const nowStuff = stuff
	if (nowStuff === null) return

	await globalMutex.executeWithAcquiredAsync(Lock.Update, () => {
		const entityContainer = nowStuff.state.entities
		const result = nowStuff.mousePicker.pick(ctx, event.offsetX, 720 - event.offsetY)
		if (result.pickedType === MousePickableType.Terrain) {
			let wasAny = false
			const entities = iterateOverAllSelectedEntities(entityContainer)
			if (nowStuff.state.groundItems.getItem(result.x, result.z) !== ItemType.None) {
				for (const record of entities) {
					if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
						continue
					wasAny = true
					interruptRequestItemPickUp(entityContainer, record, result.x, result.z, ItemType.Box)
				}
			} else
				for (const record of entities) {
					if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
						continue
					wasAny = true
					interruptRequestWalk(entityContainer, record, result.x, result.z)
				}

			if (!wasAny) {
				if (event.button === 0)
					// world.setBlock(result.x + result.normals[0]!, result.y + result.normals[1]!, result.z + result.normals[2]!, BlockId.Snow)
					nowStuff.state.groundItems.setItem(result.x, result.z, ItemType.Box)
				else
					nowStuff.state.world.setBlock(result.x, result.y, result.z, BlockId.Air)
			}
		} else if (result.pickedType === MousePickableType.Unit) {
			const id = result.numericId
			const record = getEntityById_drawableItem(entityContainer, id)
			if (record !== null) {
				{
					const rawData = entityContainer.drawables.rawData
					let color = rawData[record.drawable + DataOffsetDrawables.ColorPaletteId]! as UnitColorPaletteId
					color = (color === UnitColorPaletteId.DarkBlue) ? UnitColorPaletteId.GreenOrange : UnitColorPaletteId.DarkBlue
					rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] = color
				}
				if (event.button !== 0) {
					const rawData = entityContainer.itemHoldables.rawData
					let item = rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType
					item = (item === ItemType.Box) ? ItemType.None : ItemType.Box
					rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId] = item
				}
			}
		}
	})
}
canvas.addEventListener('click', mouseEventListener)
canvas.addEventListener('contextmenu', mouseEventListener)

renderer.beforeRenderFunction = (secondsSinceLastFrame) => document.hasFocus()
renderer.beginRendering()

const moveCameraByKeys = (camera: Camera, dt: number) => {
	if (!KEYBOARD.isAnyPressed()) return
	const speed = dt * 1.2 * camera.eye[1]

	const front1 = vec3.subtract(vec3.create(), camera.center, camera.eye)
	vec3.normalize(front1, front1)
	if (KEYBOARD.isPressed('KeyW') || KEYBOARD.isPressed('ArrowUp')) {
		camera.moveCamera(0, 0, speed)
	}
	if (KEYBOARD.isPressed('KeyS') || KEYBOARD.isPressed('ArrowDown')) {
		camera.moveCamera(0, 0, -speed)
	}
	if (KEYBOARD.isPressed('KeyA') || KEYBOARD.isPressed('ArrowLeft')) {
		camera.moveCamera(speed, 0, 0)
	}
	if (KEYBOARD.isPressed('KeyD') || KEYBOARD.isPressed('ArrowRight')) {
		camera.moveCamera(-speed, 0, 0)
	}
	if (KEYBOARD.isPressed('ShiftLeft')) {
		camera.moveCamera(0, -speed, 0)
	}
	if (KEYBOARD.isPressed('Space')) {
		camera.moveCamera(0, speed, 0)
	}
	if (KEYBOARD.isPressed('KeyP')) {
		// if (!updater.isStopRequested)
		// 	updater.stop().then(r => r === 'stopped' && console.log('Paused'))
	}
	if (KEYBOARD.isPressed('KeyR')) {
		// updater.start()
	}

	camera.lastEyeChangeId++
}


function recreateGameState(data: any, delay: number, connection: Connection) {
	const updater = stateUpdaterFromReceived(globalMutex, connection, data['updater'])
	const state = GameState.forRenderer(data['game'])
	const units = createNewUnitRenderable(renderer, state)
	const terrain = createNewTerrainRenderable(renderer, state.world)
	stuff = {
		state, updater,
		terrain, units,
		workerStartDelay: delay,
		groundItems: createNewItemOnGroundRenderable(renderer, state),
		heldItems: createHeldItemRenderable(renderer, state),
		mousePicker: createPicker(renderer.rawContext, [terrain.renderForMousePicker, units.renderForMousePicker]),
	}
}

(async () => {
	const controller = await UpdateWorkerController.spawnNew(globalMutex)

	setMessageHandler('game-snapshot-for-renderer', (data, c) => {
		recreateGameState(data, controller.workerStartDelay, c)
		stuff?.updater.start(20)
	})

	controller.replier.send('create-game', undefined)
})()
