import { DEBUG } from '@build'
import GPUBuffer from '../gpu-resources/buffer'
import GlProgram from '../gpu-resources/program'
import VertexArray from '../gpu-resources/vao'
import GPUTexture from '@3d/gpu-resources/texture'

const getAllUniforms = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
  const allNames: string[] = []
  const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(program, i)!['name']
    if (name.startsWith('gl_') || name.startsWith('webgl_gl_')) continue
    if (!name.startsWith('u_')) throw new Error(`Uniform name '${name}' doesn't start with proper prefix`)
    allNames.push(name)
  }
  const mapped = Object.fromEntries(allNames.map(name => [name.substring(2), gl.getUniformLocation(program, name)]))
  return DEBUG ? { ...mapped, names: allNames } : mapped
}

const getAllAttributes = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
  const allNames: string[] = []
  const count: number = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveAttrib(program, i)!['name']
    if (name.startsWith('gl_')) continue
    if (!name.startsWith('a_')) throw new Error(`Attribute name '${name}' doesn't start with proper prefix`)
    allNames.push(name)
  }
  const mapped = Object.fromEntries(allNames.map(name => [name.substring(2), gl.getAttribLocation(program, name)]))
  return DEBUG ? { ...mapped, names: allNames } : mapped
}

const printShaderSourceWithLines = (isError: boolean, gl: WebGL2RenderingContext, shader: WebGLShader) => {
  const source = gl
    .getShaderSource(shader)
    ?.split('\n')
    ?.map((content, index) => (index + 1).toString().padStart(3, '0') + `:  ` + content)
    ?.join('\n')

  console[isError ? 'error' : 'warn'](source)
}

const isCompilationOk = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  vs: WebGLShader,
  fs: WebGLShader,
): boolean => {
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return true

  const vsStatus = gl.getShaderInfoLog(vs)
  const fsStatus = gl.getShaderInfoLog(fs)

  const errorText = `Linking error: ${gl.getProgramInfoLog(program)}\nvs: ${vsStatus || 'OK'}\nfs: ${fsStatus || 'OK'}`

  console['groupCollapsed'](errorText)

  printShaderSourceWithLines(!!vsStatus, gl, vs)
  printShaderSourceWithLines(!!fsStatus, gl, fs)

  console['groupEnd']()
  return false
}

export const newGpuAllocator = (gl: WebGL2RenderingContext) => {
  let resolveProgramsInstantly = false
  const programsToResolve: (() => void)[] = []

  return {
    unsafeRawContext() {
      return gl
    },
    endProgramCompilationPhase() {
      resolveProgramsInstantly = true
      for (const p of programsToResolve) p()
      programsToResolve.length = 0
    },

    newProgram<Attributes extends string, Uniforms extends string>(params: {
      vertexSource: string
      fragmentSource: string
    }): Promise<GlProgram<Attributes, Uniforms>> {
      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
      gl.shaderSource(vertexShader, params.vertexSource.trim())
      gl.compileShader(vertexShader)

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(fragmentShader, params.fragmentSource.trim())
      gl.compileShader(fragmentShader)

      const program = gl.createProgram()!
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      return new Promise((resolve, reject) => {
        const callback = () => {
          if (!isCompilationOk(gl, program, vertexShader, fragmentShader)) {
            reject('Compilation failed')
            return
          }

          resolve(
            new GlProgram<Attributes, Uniforms>(
              gl,
              program,
              getAllUniforms(gl, program) as unknown as any,
              getAllAttributes(gl, program) as unknown as any,
            ),
          )
        }
        if (resolveProgramsInstantly) callback()
        else programsToResolve.push(callback)
      })
    },

    newVao() {
      const array = gl.createVertexArray()!
      return new VertexArray(gl, array)
    },

    newBuffer(options: { dynamic: boolean; forArray: boolean }) {
      const buffer = gl.createBuffer()!

      const usage = options.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW
      const target = options.forArray ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER
      return new GPUBuffer(gl, buffer, target, usage)
    },

    newTexture(options: { textureSlot: number }) {
      const texture = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + options.textureSlot)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

      return new GPUTexture(gl, texture, options.textureSlot)
    },

    newUniformBuffer() {
      const buffer = gl.createBuffer()!

      const usage = gl.DYNAMIC_DRAW
      const target = gl.UNIFORM_BUFFER
      return { buffer: new GPUBuffer(gl, buffer, target, usage), raw: buffer }
    },

    cleanUp() {
      gl['getExtension']('WEBGL_lose_context')?.['loseContext']?.()
    },
  }
}
export type GpuAllocator = ReturnType<typeof newGpuAllocator>
