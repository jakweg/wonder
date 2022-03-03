import { GameState } from './3d-stuff/game-state/game-state'
import { MainRenderer } from './3d-stuff/main-renderer'
import { createPicker } from './3d-stuff/mouse-picker'
import createHeldItemRenderable from './3d-stuff/renderable/held-item/held-item'
import createNewItemOnGroundRenderable from './3d-stuff/renderable/item-on-ground/item-on-ground'
import { RenderContext } from './3d-stuff/renderable/render-context'
import { createNewTerrainRenderable } from './3d-stuff/renderable/terrain/terrain'
import { createNewUnitRenderable } from './3d-stuff/renderable/unit/unit'
import { JS_ROOT } from './build-info'
import { Camera } from './camera'
import KEYBOARD from './keyboard-controller'
import * as vec3 from './util/matrix/vec3'
import Mutex, { Lock } from './util/mutex'


const mutex = Mutex.createNew()

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const renderer = MainRenderer.fromHTMLCanvas(canvas)
const camera = Camera.newPerspective(90, 1280 / 720)
camera.moveCamera(9.5, 0, 7)

interface GameFrontendStuff {
	state: GameState,
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

const thingsToRender: ((ctx: RenderContext) => void)[] = []
let lastContext: RenderContext | null = null
renderer.renderFunction = async (gl, dt) => {
	await mutex.executeWithAcquiredAsync(Lock.Update, () => {
		const now = performance.now()

		const ctx: RenderContext = {
			gl,
			camera,
			sunPosition,
			// gameTickEstimation: updater.estimateCurrentGameTickTime(),
			gameTickEstimation: 0,
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

		for (const r of thingsToRender) {
			r(ctx)
		}
		const nowStuff = stuff
		if (nowStuff === null) return
		nowStuff.terrain.render(ctx)
		nowStuff.units.render(ctx)
		nowStuff.heldItems.render(ctx)
		nowStuff.groundItems.render(ctx)
	})
}

// const mouseEventListener = (event: MouseEvent) => {
// 	event.preventDefault()
// 	const ctx = lastContext
// 	if (!ctx) return
//
// 	const result = mousePicker.pick(ctx, event.offsetX, 720 - event.offsetY)
// 	if (result.pickedType === MousePickableType.Terrain) {
// 		let wasAny = false
// 		const entities = iterateOverAllSelectedEntities(entityContainer)
// 		if (itemsOnGround.getItem(result.x, result.z) !== ItemType.None) {
// 			for (const record of entities) {
// 				if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
// 					continue
// 				wasAny = true
// 				interruptRequestItemPickUp(entityContainer, record, result.x, result.z, ItemType.Box)
// 			}
// 		} else
// 			for (const record of entities) {
// 				if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
// 					continue
// 				wasAny = true
// 				interruptRequestWalk(entityContainer, record, result.x, result.z)
// 			}
//
// 		if (!wasAny) {
// 			if (event.button === 0)
// 				// world.setBlock(result.x + result.normals[0]!, result.y + result.normals[1]!, result.z + result.normals[2]!, BlockId.Snow)
// 				itemsOnGround.setItem(result.x, result.z, ItemType.Box)
// 			else
// 				world.setBlock(result.x, result.y, result.z, BlockId.Air)
// 		}
// 	} else if (result.pickedType === MousePickableType.Unit) {
// 		const id = result.numericId
// 		const record = getEntityById_drawableItem(entityContainer, id)
// 		if (record !== null) {
// 			{
// 				const rawData = state.entities.drawables.rawData
// 				let color = rawData[record.drawable + DataOffsetDrawables.ColorPaletteId]! as UnitColorPaletteId
// 				color = (color === UnitColorPaletteId.DarkBlue) ? UnitColorPaletteId.GreenOrange : UnitColorPaletteId.DarkBlue
// 				rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] = color
// 			}
// 			if (event.button !== 0) {
// 				const rawData = state.entities.itemHoldables.rawData
// 				let item = rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType
// 				item = (item === ItemType.Box) ? ItemType.None : ItemType.Box
// 				rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId] = item
// 			}
// 		}
// 	}
// }
// canvas.addEventListener('click', mouseEventListener)
// canvas.addEventListener('contextmenu', mouseEventListener)

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


function recreateGameState(data: any) {
	const state = GameState.forRenderer(data.snapshot)
	const units = createNewUnitRenderable(renderer, state)
	const terrain = createNewTerrainRenderable(renderer, state.world)
	stuff = {
		state,
		terrain, units,
		groundItems: createNewItemOnGroundRenderable(renderer, state),
		heldItems: createHeldItemRenderable(renderer, state),
		mousePicker: createPicker(renderer.rawContext, [terrain.renderForMousePicker, units.renderForMousePicker]),
	}
}

mutex.executeWithAcquired(Lock.Update, () => {
	const worker = new Worker(JS_ROOT + '/worker.js')
	worker.onmessage = ({data}) => {
		if (data.type === 'renderer-snapshot') {
			recreateGameState(data)
		} else throw new Error(`Unknown type ${data.type}`)
	}
	worker.postMessage({type: 'set-mutex', mutex: mutex.pass()})
	worker.postMessage({type: 'create-game'})
	worker.postMessage({type: 'resume-game'})
})
