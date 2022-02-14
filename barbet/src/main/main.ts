import { MainRenderer } from './3d-stuff/main-renderer'
import { RenderContext } from './3d-stuff/renderable/render-context'
import { createNewTerrainRenderable } from './3d-stuff/renderable/terrain'
import { createNewUnitRenderable } from './3d-stuff/renderable/unit'
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
camera.moveCamera(6, 4, 12)

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

const terrain = createNewTerrainRenderable(renderer, world)
const unit = createNewUnitRenderable(renderer)

const sunPosition = vec3.fromValues(-500, 500, -500)

const firstRenderTime = Date.now()
renderer.renderFunction = (gl, dt) => {
	const now = Date.now()

	const ctx: RenderContext = {
		gl,
		camera,
		sunPosition,
		secondsSinceFirstRender: (now - firstRenderTime) / 1000,
	}
	moveCameraByKeys(camera, dt)
	camera.updateMatrixIfNeeded()
	Object.freeze(ctx)

	const r = 200
	sunPosition[0] = Math.cos(ctx.secondsSinceFirstRender) * r + 10
	sunPosition[2] = Math.sin(ctx.secondsSinceFirstRender) * r + 10

	terrain.render(ctx)
	unit.render(ctx)
}

renderer.beforeRenderFunction = (secondsSinceLastFrame) => secondsSinceLastFrame > 0.5 || document.hasFocus()
renderer.beginRendering()

const moveCameraByKeys = (camera: Camera, dt: number) => {
	if (!KEYBOARD.isAnyPressed()) return
	const speed = dt * 3 * camera.eye[1]

	const front1 = vec3.subtract(vec3.create(), camera.center, camera.eye)
	vec3.normalize(front1, front1)
	if (KEYBOARD.isPressed('KeyW') || KEYBOARD.isPressed('ArrowUp')) {
		camera.moveCamera(speed, 0, 0)
	}
	if (KEYBOARD.isPressed('KeyS') || KEYBOARD.isPressed('ArrowDown')) {
		camera.moveCamera(-speed, 0, 0)
	}
	if (KEYBOARD.isPressed('KeyA') || KEYBOARD.isPressed('ArrowLeft')) {
		camera.moveCamera(0, 0, -speed)
	}
	if (KEYBOARD.isPressed('KeyD') || KEYBOARD.isPressed('ArrowRight')) {
		camera.moveCamera(0, 0, speed)
	}
	if (KEYBOARD.isPressed('ShiftLeft')) {
		camera.moveCamera(0, -speed, 0)
	}
	if (KEYBOARD.isPressed('Space')) {
		camera.moveCamera(0, speed, 0)
	}

	camera.lastEyeChangeId++
}
