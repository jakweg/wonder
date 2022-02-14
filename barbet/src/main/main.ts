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

const world = World.createEmpty(500, 50, 500, BlockId.Air)
const settings = {...world.size, biomeSeed: 123, heightSeed: 1234}
const renderer = MainRenderer.fromHTMLCanvas(canvas)
const camera = Camera.newPerspective(90, 1280 / 720)
// const sunCamera = Camera.newPerspective(45, 1/1)
const sunCamera = Camera.newOrtho()
sunCamera.center[0] = settings.sizeX / 2
sunCamera.center[1] = 0
sunCamera.center[2] = settings.sizeZ / 2
sunCamera.eye[1] = 500
camera.moveCamera(25, 80, 180)

const biomeMap = generateBiomeMap(settings)
const heightMap = generateHeightMap(settings)

let index = 0
for (let z = 0; z < settings.sizeZ; z++) {
	for (let x = 0; x < settings.sizeX; x++) {
		const biomeValue = allBiomes[biomeMap[index]!]!
		let yHere = heightMap[index]!
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
for (let i = 0; i < settings.sizeY; i++)
	world.setBlock(70, i, 70, BlockId.Stone)

for (let j = 20; j < 30; j++)
	for (let i = 0; i < settings.sizeY; i++)
		world.setBlock(j, i, 40, BlockId.Sand)

for (let j = 30; j < 40; j++)
	for (let i = 0; i < settings.sizeY; i++)
		world.setBlock(j, i, 50, BlockId.Gravel)

for (let i = 0; i < 20; i++) {
	for (let j = 0; j < 20; j++) {
		for (let k = 0; k < 20; k++) {
			world.setBlock(i + settings.sizeX / 2 | 0, settings.sizeY - j - 1, k + settings.sizeZ / 2 | 0, BlockId.Stone)
		}
	}
}

const terrain = createNewTerrainRenderable(renderer, world)

const firstRenderTime = Date.now()
let xd = true
renderer.renderFunction = (gl, dt) => {
	const now = Date.now()

	const ctx: RenderContext = {
		gl,
		// sunCamera: camera, camera: sunCamera,
		camera, sunCamera,
		sunPosition: vec3.fromValues(-300, 2500, -1000),
		secondsSinceFirstRender: (now - firstRenderTime) / 1000,
	}
	Object.freeze(ctx)
	moveCameraByKeys(ctx.camera, dt)


	if (xd) {

		const nowInSeconds = now / 2000
		// const nowInSeconds = 1
		const r = settings.sizeX / 2 * 3
		ctx.sunCamera.eye[0] = Math.cos(nowInSeconds) * r + settings.sizeX / 2
		ctx.sunCamera.eye[1] = Math.cos(nowInSeconds / 2) * 200 + 620
		ctx.sunCamera.eye[2] = Math.sin(nowInSeconds) * r + settings.sizeZ / 2

		ctx.sunCamera.lastEyeChangeId++
		ctx.sunCamera.updateMatrixIfNeeded()

		terrain.renderDepth(ctx)
	}
	ctx.camera.updateMatrixIfNeeded()
	terrain.render(ctx)

}
// setTimeout(() => xd = false, 5000)

renderer.beforeRenderFunction = (secondsSinceLastFrame) => secondsSinceLastFrame > 5 || document.hasFocus()
renderer.beginRendering()

const moveCameraByKeys = (camera: Camera, dt: number) => {
	if (!KEYBOARD.isAnyPressed()) return
	const speed = dt * 3 * camera.eye[1]

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
