import { toRadian } from './util/matrix/common'
import * as mat4 from './util/matrix/mat4'
import * as vec3 from './util/matrix/vec3'

export const universalUpVector = vec3.fromValues(0, 1, 0)

export class Camera {
	public lastEyeChangeId: number = 1
	private lastRegisteredEyeChangeId: number = 0

	private constructor(public readonly perspectiveMatrix: mat4,
	                    public readonly viewMatrix: mat4,
	                    public readonly eye: vec3,
	                    public readonly center: vec3) {
	}

	public static newPerspective(fovDegress: number,
	                             aspect: number) {
		const perspectiveMatrix = mat4.perspectiveNO(
			mat4.create(),
			toRadian(fovDegress),
			aspect,
			0.1, 5000)

		const eye = vec3.fromValues(-2.1, 4, -3.0001)
		const center = vec3.fromValues(0, 0, 0)
		const viewMatrix = mat4.lookAt(
			mat4.create(),
			eye,
			center,
			universalUpVector)

		return new Camera(perspectiveMatrix, viewMatrix, eye, center)
	}

	public updateMatrixIfNeeded(): void {
		if (this.lastRegisteredEyeChangeId === this.lastEyeChangeId) return
		this.lastRegisteredEyeChangeId = this.lastEyeChangeId
		mat4.lookAt(this.viewMatrix, this.eye, this.center, universalUpVector)
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
