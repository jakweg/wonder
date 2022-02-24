import { GameState } from './3d-stuff/game-state/game-state'
import { StateUpdater } from './3d-stuff/game-state/state-updater'
import { MainRenderer } from './3d-stuff/main-renderer'
import { createNewItemRenderable } from './3d-stuff/renderable/item/item'
import { RenderContext } from './3d-stuff/renderable/render-context'
import { createNewTerrainRenderable } from './3d-stuff/renderable/terrain/terrain'
import { createNewUnitRenderable } from './3d-stuff/renderable/unit/unit'
import { UnitColorPaletteId } from './3d-stuff/renderable/unit/unit-color'
import { BlockId } from './3d-stuff/world/block'
import { World } from './3d-stuff/world/world'
import { Camera } from './camera'
import KEYBOARD from './keyboard-controller'
import * as vec3 from './util/matrix/vec3'

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const renderer = MainRenderer.fromHTMLCanvas(canvas)
const camera = Camera.newPerspective(90, 1280 / 720)
camera.moveCamera(9.5, 0, 7)

const world = World.createEmpty(20, 30, 20, BlockId.Air)
for (let i = 0, w = world.size.sizeX; i < w; i++)
	for (let j = 0, h = world.size.sizeZ; j < h; j++)
		world.setBlock(i, 0, j, BlockId.Water)

for (let i = 2, w = world.size.sizeX - 2; i < w; i++)
	for (let j = 2, h = world.size.sizeZ - 2; j < h; j++)
		world.setBlock(i, 1, j, BlockId.Sand)
for (let i = 3, w = world.size.sizeX - 3; i < w; i++)
	for (let j = 3, h = world.size.sizeZ - 3; j < h; j++)
		world.setBlock(i, 1, j, BlockId.Grass)

world.setBlock(7, 2, 14, BlockId.Stone)
world.setBlock(7, 3, 14, BlockId.Stone)
world.setBlock(6, 2, 13, BlockId.Stone)
world.setBlock(6, 3, 13, BlockId.Stone)

const terrain = createNewTerrainRenderable(renderer, world)
const state = GameState.createNew()
const updater = StateUpdater.createNew(state, 20)
updater.start()
state.spawnUnit(8, 6, UnitColorPaletteId.LightOrange)

const unit = createNewUnitRenderable(renderer, state)
const items = createNewItemRenderable(renderer, state)

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
		if (await updater.stop() === 'stopped') {
			updater.start(speedToSet)
		}
	})

let lastContext: RenderContext | null = null
renderer.renderFunction = (gl, dt) => {
	const now = performance.now()

	const ctx: RenderContext = {
		gl,
		camera,
		sunPosition,
		gameTickEstimation: updater.estimateCurrentGameTickTime(),
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

	terrain.render(ctx)
	unit.render(ctx)
	items.render(ctx)
}

const mouseEventListener = (event: MouseEvent) => {
	event.preventDefault()
	const ctx = lastContext
	if (!ctx) return
	const block = terrain.getBlockByMouseCoords(ctx, event.offsetX, 720 - event.offsetY)
	if (block === null) return
	const top = world.getHighestBlockHeight(block.x, block.z)
	if (event.button === 0)
		world.setBlock(block.x, top + 1, block.z, BlockId.Gravel)
	else
		world.setBlock(block.x, top, block.z, BlockId.Air)
	terrain.requestRebuildMesh()
}
canvas.addEventListener('click', mouseEventListener)
canvas.addEventListener('contextmenu', mouseEventListener)

renderer.beforeRenderFunction = (secondsSinceLastFrame) => secondsSinceLastFrame > 0.5 || document.hasFocus()
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
		if (!updater.isStopRequested)
			updater.stop().then(r => r === 'stopped' && console.log('Paused'))
	}
	if (KEYBOARD.isPressed('KeyR')) {
		updater.start()
	}

	camera.lastEyeChangeId++
}
