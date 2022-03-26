import { frontedVariables, FrontendVariable } from '../util/frontend-variables'
import { RenderContext } from './renderable/render-context'

export const enum MousePickableType {
	Nothing,
	Terrain,
	Unit,
}

interface MousePickerNothingResult {
	pickedType: MousePickableType.Nothing
}

interface MousePickerTerrainResult {
	pickedType: MousePickableType.Terrain
	x: number
	y: number
	z: number
	normals: [number, number, number]
}

interface MousePickerUnitResult {
	pickedType: MousePickableType.Unit
	numericId: number
}

export const createPicker = (gl: WebGL2RenderingContext,
                             renderers: ((ctx: RenderContext) => void)[]) => {

	let textureWidth = -1
	let textureHeight = -1
	let fb: WebGLFramebuffer | null = null
	let texture0: WebGLTexture | null = null
	let texture1: WebGLTexture | null = null

	const preparePickerIfNeeded = () => {
		const width = Atomics.load(frontedVariables, FrontendVariable.CanvasDrawingWidth)
		const height = Atomics.load(frontedVariables, FrontendVariable.CanvasDrawingHeight)

		if (width === textureWidth && height === textureHeight && fb !== null)
			return

		textureWidth = width
		textureHeight = height

		if (fb !== null) gl.deleteFramebuffer(fb)
		if (texture0 !== null) gl.deleteTexture(texture0)
		if (texture1 !== null) gl.deleteTexture(texture1)


		fb = gl.createFramebuffer()
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb)

		texture0 = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, texture0)

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
			textureWidth, textureHeight, 0,
			gl.RGBA, gl.UNSIGNED_BYTE, null)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture0, 0)

		texture1 = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, texture1)

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB,
			textureWidth, textureHeight, 0,
			gl.RGB, gl.UNSIGNED_BYTE, null)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texture1, 0)


		gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error('invalid framebuffer status', status)
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
	}

	return {
		pick(ctx: RenderContext, mouseX: number, mouseY: number)
			: MousePickerTerrainResult | MousePickerUnitResult | MousePickerNothingResult {
			preparePickerIfNeeded()

			gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
			gl.viewport(0, 0, textureWidth, textureHeight)
			gl.clearColor(0, 0, 0, 0)
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

			for (const renderer of renderers) {
				renderer(ctx)
			}

			const readPixelsBuffer = new Uint8Array(8)
			gl.readBuffer(gl.COLOR_ATTACHMENT0)
			const pixelX = mouseX | 0
			const pixelY = mouseY | 0
			gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelsBuffer, 0)
			gl.readBuffer(gl.COLOR_ATTACHMENT1)
			gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelsBuffer, 4)
			gl.bindFramebuffer(gl.FRAMEBUFFER, null)

			const type: MousePickableType = readPixelsBuffer[6]!
			switch (type) {
				case MousePickableType.Terrain: {
					const x = readPixelsBuffer[0]! << 8 | readPixelsBuffer[1]!
					const z = readPixelsBuffer[2]! << 8 | readPixelsBuffer[3]!
					const y = readPixelsBuffer[4]!


					const normals = readPixelsBuffer[5]! & 0b111111
					const nx = ((normals >> 4) & 0b11) - 1
					const ny = ((normals >> 2) & 0b11) - 1
					const nz = ((normals >> 0) & 0b11) - 1
					return {
						pickedType: MousePickableType.Terrain,
						x, y, z, normals: [nx, ny, nz],
					}
				}
				case MousePickableType.Unit:
					const unitId = readPixelsBuffer[0]! << 16 | readPixelsBuffer[1]! << 8 | readPixelsBuffer[2]!
					return {
						pickedType: MousePickableType.Unit,
						numericId: unitId,
					}
				case MousePickableType.Nothing:
				default:
					return {pickedType: MousePickableType.Nothing}
			}
		},
	}
}
