import { setMessageHandler } from './worker/message-handler'
import { WorkerController } from './worker/worker-controller'
import { globalMutex } from './worker/worker-global-state'


const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement
canvas.width = 1280
canvas.height = 720;

// let fixedTime: number | null = null
// document.getElementById('input-u_time')
// 	?.addEventListener('input', (event) => {
// 		fixedTime = +(event.target as HTMLInputElement).value
// 	})
//
// let speedToSet = 20
// document.getElementById('input-ticksPerSecond')
// 	?.addEventListener('input', async (event) => {
// 		speedToSet = +(event.target as HTMLInputElement).value
// 		stuff?.updater?.changeTickRate(speedToSet)
// 	})
//
// let lastContext: RenderContext | null = null
//
// const mouseEventListener = async (event: MouseEvent) => {
// 	event.preventDefault()
// 	const ctx = lastContext
// 	if (!ctx) return
// 	const nowStuff = stuff
// 	if (nowStuff === null) return
//
// 	await globalMutex.executeWithAcquiredAsync(Lock.Update, () => {
// 		const entityContainer = nowStuff.state.entities
// 		const result = nowStuff.mousePicker.pick(ctx, event.offsetX, 720 - event.offsetY)
// 		if (result.pickedType === MousePickableType.Terrain) {
// 			let wasAny = false
// 			const entities = iterateOverAllSelectedEntities(entityContainer)
// 			if (nowStuff.state.groundItems.getItem(result.x, result.z) !== ItemType.None) {
// 				for (const record of entities) {
// 					if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
// 						continue
// 					wasAny = true
// 					interruptRequestItemPickUp(entityContainer, record, result.x, result.z, ItemType.Box)
// 				}
// 			} else
// 				for (const record of entities) {
// 					if (entityContainer.drawables.rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] !== UnitColorPaletteId.DarkBlue)
// 						continue
// 					wasAny = true
// 					interruptRequestWalk(entityContainer, record, result.x, result.z)
// 				}
//
// 			if (!wasAny) {
// 				if (event.button === 0)
// 					// world.setBlock(result.x + result.normals[0]!, result.y + result.normals[1]!, result.z + result.normals[2]!, BlockId.Snow)
// 					nowStuff.state.groundItems.setItem(result.x, result.z, ItemType.Box)
// 				else
// 					nowStuff.state.world.setBlock(result.x, result.y, result.z, BlockId.Air)
// 			}
// 		} else if (result.pickedType === MousePickableType.Unit) {
// 			const id = result.numericId
// 			const record = getEntityById_drawableItem(entityContainer, id)
// 			if (record !== null) {
// 				{
// 					const rawData = entityContainer.drawables.rawData
// 					let color = rawData[record.drawable + DataOffsetDrawables.ColorPaletteId]! as UnitColorPaletteId
// 					color = (color === UnitColorPaletteId.DarkBlue) ? UnitColorPaletteId.GreenOrange : UnitColorPaletteId.DarkBlue
// 					rawData[record.drawable + DataOffsetDrawables.ColorPaletteId] = color
// 				}
// 				if (event.button !== 0) {
// 					const rawData = entityContainer.itemHoldables.rawData
// 					let item = rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId]! as ItemType
// 					item = (item === ItemType.Box) ? ItemType.None : ItemType.Box
// 					rawData[record.itemHoldable + DataOffsetItemHoldable.ItemId] = item
// 				}
// 			}
// 		}
// 	})
// }
// canvas.addEventListener('click', mouseEventListener)
// canvas.addEventListener('contextmenu', mouseEventListener)
//
//
// const moveCameraByKeys = (camera: Camera, dt: number) => {
// 	if (!KEYBOARD.isAnyPressed()) return
// 	const speed = dt * 1.2 * camera.eye[1]
//
// 	const front1 = vec3.subtract(vec3.create(), camera.center, camera.eye)
// 	vec3.normalize(front1, front1)
// 	if (KEYBOARD.isPressed('KeyW') || KEYBOARD.isPressed('ArrowUp')) {
// 		camera.moveCamera(0, 0, speed)
// 	}
// 	if (KEYBOARD.isPressed('KeyS') || KEYBOARD.isPressed('ArrowDown')) {
// 		camera.moveCamera(0, 0, -speed)
// 	}
// 	if (KEYBOARD.isPressed('KeyA') || KEYBOARD.isPressed('ArrowLeft')) {
// 		camera.moveCamera(speed, 0, 0)
// 	}
// 	if (KEYBOARD.isPressed('KeyD') || KEYBOARD.isPressed('ArrowRight')) {
// 		camera.moveCamera(-speed, 0, 0)
// 	}
// 	if (KEYBOARD.isPressed('ShiftLeft')) {
// 		camera.moveCamera(0, -speed, 0)
// 	}
// 	if (KEYBOARD.isPressed('Space')) {
// 		camera.moveCamera(0, speed, 0)
// 	}
// 	if (KEYBOARD.isPressed('KeyP')) {
// 		stuff?.updater.stop().then(r => r === 'stopped' && console.log('Paused'))
// 	}
// 	if (KEYBOARD.isPressed('KeyR')) {
// 		stuff?.updater.start()
// 	}
//
// 	camera.lastEyeChangeId++
// }

(async () => {
	const renderWorker = await WorkerController.spawnNew('render-worker', 'render', globalMutex)
	const canvasControl = (canvas as any).transferControlToOffscreen()
	renderWorker.replier.send('transfer-canvas', {canvas: canvasControl}, [canvasControl])

	const updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
	updateWorker.replier.send('create-game', undefined)

	setMessageHandler('game-snapshot-for-renderer', (data) => {
		renderWorker.replier.send('game-snapshot-for-renderer', data)
	})

	setMessageHandler('start-game', data => updateWorker.replier.send('start-game', data))

	renderWorker.replier.send('set-worker-load-delays', {
		render: renderWorker.workerStartDelay,
		update: updateWorker.workerStartDelay,
	})
})()


