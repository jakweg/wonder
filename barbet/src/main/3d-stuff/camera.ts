import * as mat4 from '@matrix//mat4'
import * as vec3 from '@matrix//vec3'
import { createNewBuffer } from '@utils/shared-memory'

const FOV = Math.PI / 3
export const universalUpVector = vec3.fromValues(0, 1, 0)

export class Camera {
  private constructor(
    private readonly internalBuffer: SharedArrayBuffer,
    public readonly perspectiveMatrix: mat4,
    public readonly viewMatrix: mat4,
    public readonly combinedMatrix: mat4,
    public readonly eye: [number, number, number],
    public readonly target: [number, number, number],
  ) {}

  public static newUsingBuffer(buffer: SharedArrayBuffer): Camera {
    const floatSize = Float32Array.BYTES_PER_ELEMENT
    const perspectiveMatrix = mat4.create()

    const eye = new Float32Array(buffer, 0, 3)
    const center = new Float32Array(buffer, floatSize * 3, 3)

    const viewMatrix = mat4.lookAt(mat4.create(), eye, center, universalUpVector)

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
    mat4.perspectiveNO(this.perspectiveMatrix, FOV, aspect, 0.1, 5000)
  }

  public updateMatrix(): void {
    mat4.lookAt(this.viewMatrix, this.eye, this.target, universalUpVector)
    mat4.multiply(this.combinedMatrix, this.perspectiveMatrix, this.viewMatrix)
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
