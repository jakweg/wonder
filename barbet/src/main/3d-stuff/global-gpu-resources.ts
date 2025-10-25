import { Camera } from '@3d/camera'
import { newDrawingContextFromGl } from '@3d/gpu-resources/drawing-context'
import { createFromSpec, Spec } from '@3d/gpu-resources/ultimate-gpu-pipeline'
import * as vec3 from '@matrix/vec3'

export const makeShaderGlobals = (gl: WebGL2RenderingContext) => {
  const jsBufferForGlobals = new ArrayBuffer(
    (0 +
      16 + // camera matrix
      4 + // times + terrainHeightMultiplier
      4 + // light direction + ambient
      0) *
      Float32Array.BYTES_PER_ELEMENT +
      (0 +
        1 + // World size in chunks
        3 + // padding for future usage
        0) *
        Uint32Array.BYTES_PER_ELEMENT,
  )
  const jsBufferFloat32 = new Float32Array(jsBufferForGlobals)
  const jsBufferUint32 = new Uint32Array(jsBufferForGlobals)

  const rawUniformBuffer = gl.createBuffer()
  gl.bindBuffer(gl.UNIFORM_BUFFER, rawUniformBuffer)
  gl.bufferData(gl.UNIFORM_BUFFER, jsBufferFloat32.byteLength, gl.DYNAMIC_DRAW)
  gl.bindBuffer(gl.UNIFORM_BUFFER, null)
  const light = [0.55, 1, -0.6, 0.4]
  vec3.normalize(light, light)

  const bindProgramRaw = (programRaw: WebGLProgram): void => {
    const BINDING_POINT = 0
    const blockIndex = gl.getUniformBlockIndex(programRaw, 'Globals')

    gl.bindBuffer(gl.UNIFORM_BUFFER, rawUniformBuffer)
    gl.uniformBlockBinding(programRaw, blockIndex, BINDING_POINT)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, BINDING_POINT, rawUniformBuffer)
    gl.bindBuffer(gl.UNIFORM_BUFFER, null)
  }

  const drawing = newDrawingContextFromGl(gl)

  return {
    createGpuResources<S extends Spec<any, any, any, any, any>>(spec: S): ReturnType<typeof createFromSpec<S>> {
      const implementation = createFromSpec(gl, spec, drawing)

      for (const program of Object.values(implementation.programs)) {
        bindProgramRaw((program as any).unsafePointer)
      }
      return implementation
    },
    update(
      camera: Camera,
      secondsSinceFirstRender: number,
      gameTime: number,
      gameTickEstimation: number,
      terrainHeightMultiplier: number,
      worldSizeInChunks: number,
    ) {
      const combinedMatrix = camera.combinedMatrix
      for (let i = 0; i < 16; ++i) {
        jsBufferFloat32[i] = combinedMatrix[i]
      }

      jsBufferFloat32[16 + 0] = secondsSinceFirstRender
      jsBufferFloat32[16 + 1] = gameTime
      jsBufferFloat32[16 + 2] = gameTickEstimation
      jsBufferFloat32[16 + 3] = terrainHeightMultiplier
      jsBufferFloat32[16 + 4] = light[0]!
      jsBufferFloat32[16 + 5] = light[1]!
      jsBufferFloat32[16 + 6] = light[2]!
      jsBufferFloat32[16 + 7] = light[3]!

      jsBufferUint32[16 + 8] = worldSizeInChunks

      gl.bindBuffer(gl.UNIFORM_BUFFER, rawUniformBuffer)
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, jsBufferForGlobals)
      gl.bindBuffer(gl.UNIFORM_BUFFER, null)
    },
    cleanUp() {
      gl['getExtension']('WEBGL_lose_context')?.['loseContext']?.()
    },
  }
}

export type ShaderGlobals = ReturnType<typeof makeShaderGlobals>
