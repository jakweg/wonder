import { MainRenderer } from './3d-stuff/main-renderer'
import { RenderContext } from './3d-stuff/renderable/render-context'
import { createNewTerrainRenderable } from './3d-stuff/renderable/terrain'
import { allBiomes } from './3d-stuff/world/biome'
import { BlockId } from './3d-stuff/world/block'
import { generateBiomeMap, generateHeightMap } from './3d-stuff/world/generator'
import { World } from './3d-stuff/world/world'
import { Camera } from './camera'
import KEYBOARD from './keyboard-controller'
import * as vec3 from './util/matrix/vec3'

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720

const renderer = MainRenderer.fromHTMLCanvas(canvas)
const camera = Camera.newPerspective(90, 1280 / 720)
camera.moveCamera(25, 80, 180)

const world = World.createEmpty(1000, 30, 1000, BlockId.Air)
const settings = {...world.size, biomeSeed: 123, heightSeed: 1234}
const biomeMap = generateBiomeMap(settings)
const heightMap = generateHeightMap(settings)

let index = 0
for (let z = 0; z < settings.sizeZ; z++) {
	for (let x = 0; x < settings.sizeX; x++) {
		const biomeValue = allBiomes[biomeMap[index]!]!
		const yHere = heightMap[index]!
		world.setBlock(x, yHere, z, biomeValue.surfaceMaterialId)
		const underSurfaceMaterialId = biomeValue.underSurfaceMaterialId
		for (let y = 0; y < yHere; ++y)
			world.setBlock(x, y, z, underSurfaceMaterialId)

		if (yHere < 4) {
			const waterSurfaceMaterialId = biomeValue.waterSurfaceMaterialId
			const upperWaterLimit = 3 + (waterSurfaceMaterialId === BlockId.Water ? 0 : 1)
			for (let y = 0; y <= upperWaterLimit; ++y)
				world.setBlock(x, y, z, waterSurfaceMaterialId)
		}
		index++
	}
}
for (let i = 0; i < settings.sizeY; i++) {
	world.setBlock(100, i, 100, BlockId.Stone)
}
const terrain = createNewTerrainRenderable(renderer, world)

const sunPosition = vec3.fromValues(-300, 2500, -1000)

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

	terrain.render(ctx)
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
