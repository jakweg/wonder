import * as mat4 from './util/matrix/mat4'
import * as vec3 from './util/matrix/vec3'
import { createNewBuffer } from './util/shared-memory'

const FOV = Math.PI / 2
export const universalUpVector = vec3.fromValues(0, 1, 0)

export class Camera {
	public lastEyeChangeId: number = 1
	private lastRegisteredEyeChangeId: number = 0

	private constructor(
		private readonly internalBuffer: SharedArrayBuffer,
		public readonly perspectiveMatrix: mat4,
		public readonly viewMatrix: mat4,
		public readonly combinedMatrix: mat4,
		public readonly eye: vec3,
		public readonly center: vec3) {
	}

	public static newUsingBuffer(buffer: SharedArrayBuffer): Camera {
		const floatSize = Float32Array.BYTES_PER_ELEMENT
		const perspectiveMatrix = mat4.create()

		const eye = new Float32Array(buffer, 0, 3)
		const center = new Float32Array(buffer, floatSize * 3, 3)

		const viewMatrix = mat4.lookAt(
			mat4.create(),
			eye,
			center,
			universalUpVector)

		const combined = mat4.multiply(mat4.create(), perspectiveMatrix, viewMatrix)

		return new Camera(buffer, perspectiveMatrix, viewMatrix, combined, eye, center)
	}

	public static newPerspective(): Camera {
		const floatSize = Float32Array.BYTES_PER_ELEMENT
		const buffer = createNewBuffer(floatSize * 3 * 2)
		return this.newUsingBuffer(buffer)
	}

	public passCameraLink(): unknown {
		return {
			'buffer': this.internalBuffer,
		}
	}

	public setAspectRatio(aspect: number): void {
		mat4.perspectiveNO(
			this.perspectiveMatrix,
			FOV,
			aspect,
			0.1, 5000)
		this.lastEyeChangeId++
	}

	public updateMatrixIfNeeded(): void {
		if (this.lastRegisteredEyeChangeId === this.lastEyeChangeId) return
		this.lastRegisteredEyeChangeId = this.lastEyeChangeId
		mat4.lookAt(this.viewMatrix, this.eye, this.center, universalUpVector)
		mat4.multiply(this.combinedMatrix, this.perspectiveMatrix, this.viewMatrix)
	}

	public moveCamera(x: number, y: number, z: number): void {
		this.eye[0] += x
		this.eye[1] += y
		this.eye[2] += z
		this.center[0] += x
		this.center[1] += y
		this.center[2] += z
		this.lastEyeChangeId++
	}
}

export type CameraLink = ReturnType<typeof cameraLinkFromReceived>
export const cameraLinkFromReceived = (data: any) => {
	const buffer = data['buffer'] as SharedArrayBuffer
	const wrapped = new Float32Array(buffer)
	return {
		getValues(): number[] {
			return [...wrapped]
		},
	}
}
