import { isInWorker } from '../util/mutex'
import { createNewBuffer } from '../util/shared-memory'

export const getFromLocalStorage = (key: string): any => {
	if (isInWorker) throw new Error('Attempt to read storage in worker')
	const item = localStorage.getItem(key)
	if (item != null) {
		try {
			return JSON.parse(item)
		} catch (e) {
			console.error(`Parse error of saved item key=${key}`)
			localStorage.removeItem(key)
		}
	}
	return undefined
}

export const putInLocalStorage = (key: string, value: any): void => {
	localStorage.setItem(key, JSON.stringify(value))
}

let cameraBuffer: SharedArrayBuffer | null = null
export const getCameraBuffer = () => {
	if (cameraBuffer === null) {
		let array = getFromLocalStorage('camera/buffer')
		if (array == undefined || array.length !== 6)
			array = [2.1, 4, -3.0001, 0, 0, 0]
		cameraBuffer = createNewBuffer(6 * Float32Array.BYTES_PER_ELEMENT)
		const tmp = new Float32Array(cameraBuffer)
		for (let i = 0; i < 6; i++) tmp[i] = array[i]!
	}
	return cameraBuffer
}
export const setCameraBuffer = (buffer: SharedArrayBuffer) => {
	cameraBuffer = buffer
}

export const save = () => {
	if (isInWorker) throw new Error('Attempt to save storage in worker')
	putInLocalStorage('camera/buffer', [...new Float32Array(getCameraBuffer())])
}

export const registerSaveSettingsCallback = () => {
	window.addEventListener('beforeunload', () => save())
}
