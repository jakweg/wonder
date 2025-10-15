import { GlobalUniformBlockDeclaration, PrecisionHeader, VersionHeader } from '@3d/common-shader'
import { TextureSlot } from '@3d/texture-slot-counter'
import { DEBUG } from '@build'
import TypedArray from '@seampan/typed-array'

export enum AttrType {
  Float,
  UByte,
  UShort,
  UInt,
}

const getGlName = (count: number, type: AttrType) => {
  switch (count) {
    case 1: {
      switch (type) {
        case AttrType.Float:
          return 'float'
        case AttrType.UByte:
        case AttrType.UShort:
        case AttrType.UInt:
          return 'uint'
      }
    }
    case 2:
    case 3:
    case 4: {
      switch (type) {
        case AttrType.Float:
          return 'vec' + count
        case AttrType.UByte:
        case AttrType.UShort:
        case AttrType.UInt:
          return 'uvec' + count
      }
    }
  }
  throw new Error()
}

const isInt = (type: AttrType) => type !== AttrType.Float
const getBytesSize = (type: AttrType) => {
  switch (type) {
    case AttrType.UInt:
    case AttrType.Float:
      return 4
    case AttrType.UShort:
      return 2
    case AttrType.UByte:
      return 1
    default:
      throw new Error()
  }
}
const getGlValue = (gl: WebGL2RenderingContext, type: AttrType) => {
  switch (type) {
    case AttrType.Float:
      return gl['FLOAT']
    case AttrType.UShort:
      return gl['UNSIGNED_SHORT']
    case AttrType.UByte:
      return gl['UNSIGNED_BYTE']
    case AttrType.UInt:
      return gl['UNSIGNED_INT']
    default:
      throw new Error()
  }
}

type AttributeSpecification<B extends string | symbol | number> = {
  count: number
  divisor?: number
} & (
  | { type: AttrType.Float } // float can't be normalized
  | { type: Exclude<AttrType, AttrType.Float>; normalize?: boolean }
) &
  (
    | {
        disabled: true
      }
    | {
        disabled?: false
        bindTo: Record<B, true>
      }
  )

type UniformSpecification = { type: string }
type VaryingSpecification = { type: string; flat?: boolean }
type TextureSamplerSpecification = {}
type TextureSpecification = { textureSlot: TextureSlot; float32?: boolean }

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N
type NeverIfAny<T> = IfAny<T, never, T>

export interface Spec<
  B extends string | number | symbol,
  P extends string | number | symbol,
  U extends string | number | symbol,
  T extends string | number | symbol,
  AM extends Record<P, string | number | symbol> = any,
> {
  buffers?: Record<B, { dynamic: boolean; element?: true }>
  programs?: Record<
    P,
    {
      utilDeclarations?:
        | string
        | ((variables: Record<NeverIfAny<T> | NeverIfAny<U> | NeverIfAny<AM[P]> | string, string>) => string)

      vertexMain: (variables: Record<NeverIfAny<T> | NeverIfAny<U> | NeverIfAny<AM[P]> | string, string>) => string
      vertexFinalPosition: string

      skipWorldTransform?: boolean

      fragmentMain: (variables: Record<NeverIfAny<T> | NeverIfAny<U> | NeverIfAny<AM[P]> | string, string>) => string
      fragmentFinalColor: string
      fragmentEntityId?: string

      attributes?: Record<AM[P], AttributeSpecification<B>>

      varyings?: Record<string, VaryingSpecification>

      uniforms?: Record<U, UniformSpecification>
      textureSamplers?: Partial<Record<T, TextureSamplerSpecification>>
    }
  >
  textures?: Record<T, TextureSpecification>
}

type AnySpec<
  S extends Spec<keyof S['buffers'], keyof S['programs'], keyof S['programs'][any]['uniforms'], keyof S['textures']>,
> = Spec<keyof S['buffers'], keyof S['programs'], keyof S['programs'][any]['uniforms'], keyof S['textures']>

type Implementation<S extends AnySpec<S>> = {
  start: () => void
  stop: () => void
  buffers: Record<keyof S['buffers'], { setContent: (value: TypedArray) => void }>
  programs: {
    [P in keyof S['programs']]: {
      use: () => void
      getPointer(): WebGLProgram
      unsafeUniformLocations: Record<
        S['programs'][P] extends { uniforms: infer U } ? keyof U : never,
        WebGLUniformLocation
      >
    }
  }
  textures: Record<
    keyof S['textures'],
    {
      setContentSquare: (value: TypedArray, sizeInOneDimension: number) => void
      setContent2D: (value: TypedArray, width: number, height: number) => void
    }
  >
}

export const createFromSpec = <S extends AnySpec<S>>(gl: WebGL2RenderingContext, s: S): Implementation<S> => {
  const buffers = createBuffers(gl, s)
  const textures = createTextures(gl, s)
  const programs = createPrograms(gl, s, textures)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  bindAttributesToBuffers(gl, buffers, programs)

  gl.bindVertexArray(null)

  return {
    start() {
      gl.bindVertexArray(vao)
    },
    stop() {
      gl.bindVertexArray(null)
    },
    buffers,
    textures,
    programs,
  }
}

function bindAttributesToBuffers(gl: WebGL2RenderingContext, buffers: any, programs: any) {
  for (const program of Object.values(programs)) {
    const attributeLocations = (program as any).attributes as Record<any, number>
    const attributes = ((program as any).spec.attributes ?? {}) as Record<any, AttributeSpecification<any>>
    const entries = Object.entries(attributes) as [string, AttributeSpecification<any>][]

    const totalSize = entries.map(([_, v]) => v.count * getBytesSize(v.type))['reduce']((a, b) => a + b, 0)

    let offset = 0
    for (const [key, attribute] of entries) {
      const index = attributeLocations[key]
      const type = attribute.type
      if (index !== undefined) {
        if (attribute.disabled === true) {
          gl.disableVertexAttribArray(index)
          continue
        }

        const [bufferName, ...rest] = Object.keys(attribute.bindTo)
        // There must be only a single bindTo buffer
        if (rest.length || !bufferName) throw new Error()

        const foundBuffer = buffers[bufferName]
        if (!foundBuffer?.unsafePointer || foundBuffer?.spec?.element) throw new Error()

        gl.bindBuffer(gl.ARRAY_BUFFER, foundBuffer.unsafePointer)

        gl.enableVertexAttribArray(index)

        if ((attribute as any).normalize === undefined ? isInt(type) : false)
          gl.vertexAttribIPointer(index, attribute.count, getGlValue(gl, type), totalSize, offset)
        else
          gl.vertexAttribPointer(
            index,
            attribute.count,
            getGlValue(gl, type),
            (attribute as any).normalize ?? false,
            totalSize,
            offset,
          )

        if (attribute.divisor !== undefined) {
          gl.vertexAttribDivisor(index, attribute.divisor)
        }
      }
      offset += attribute.count * getBytesSize(type)
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null)
}

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

function buildShaderSource(params: {
  isVertex: boolean
  skipWorldTransform: boolean
  textures: any
  uniforms: Record<string, UniformSpecification>
  textureSamplers: Partial<Record<string, TextureSamplerSpecification>>
  attributes?: Record<string, AttributeSpecification<any>>
  varyings: Record<string, VaryingSpecification>
  mainSource: (variables: any) => string
  utilDeclarations: any
  finalVariable: string | [string, string | undefined]
}) {
  const availableVariables: any = {}
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), GlobalUniformBlockDeclaration())

  for (const [n, u] of Object.entries(params.uniforms)) {
    parts.push('uniform ', u.type, ' u_', n, ';\n')
    availableVariables[n] = 'u_' + n
  }

  for (const [n, u] of Object.entries(params.textureSamplers)) {
    parts.push('uniform ', params.textures[n].spec.float32 ? 'sampler2D' : 'usampler2D', ' u_', n, ';\n')
    availableVariables[n] = 'u_' + n
  }

  for (const [n, v] of Object.entries(params.varyings)) {
    parts.push(v.flat ? 'flat ' : '', params.isVertex ? 'out ' : 'in ', v.type, ' v_', n, ';\n')
    availableVariables[n] = 'v_' + n
  }

  for (const [n, a] of Object.entries(params.attributes ?? {})) {
    parts.push('in ', getGlName(a.count, a.type), ' a_', n, ';\n')
    availableVariables[n] = 'a_' + n
  }

  const handler = {
    get(target: any, property: any, receiver: any) {
      const value = Reflect.get(target, property, receiver)
      if (!value)
        throw `Attempt to read "${String(property)}" in ${
          params.isVertex ? 'vertex' : 'fragment'
        } shader, but not existing!`
      return value
    },
  }
  const safeAvailableVariables = new Proxy(availableVariables, handler)

  if (!params.isVertex) {
    parts.push('layout(location=0) out vec4 finalFinalColor;\n')
    if (typeof params.finalVariable !== 'string' && params.finalVariable[1]) {
      parts.push('layout(location=1) out uint finalFinalEntityId;\n')
    }
  }

  if (typeof params.utilDeclarations === 'string') {
    parts.push(params.utilDeclarations)
  } else if (params.utilDeclarations) {
    parts.push(params.utilDeclarations(safeAvailableVariables))
  }

  parts.push('void main() {\n', params.mainSource(safeAvailableVariables))
  if (params.isVertex) {
    if (params.skipWorldTransform) {
      parts.push('gl_Position = vec4(', params.finalVariable.toString(), ', 1);\ngl_PointSize = 10.0;\n}\n')
    } else {
      parts.push(
        'gl_Position = u_combinedMatrix * vec4(',
        params.finalVariable.toString(),
        ', 1);\ngl_PointSize = 10.0;\n}\n',
      )
    }
  } else {
    if (typeof params.finalVariable === 'string') parts.push('finalFinalColor = vec4(', params.finalVariable, ');\n}\n')
    else {
      parts.push('finalFinalColor = vec4(', params.finalVariable[0], ');\n')
      if (params.finalVariable[1]) {
        parts.push('finalFinalEntityId = uint(', params.finalVariable[1], ');\n')
      }
      parts.push('}\n')
    }
  }

  return parts.join('')
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

function createPrograms<S extends AnySpec<S>>(gl: WebGL2RenderingContext, s: S, textures: any) {
  return Object.fromEntries(
    Object.entries(s.programs ?? {}).map(entry => {
      const description = entry[1]! as AnySpec<S>['programs'][keyof AnySpec<S>['programs']]

      const vertexSource = buildShaderSource({
        uniforms: description.uniforms ?? {},
        textures: textures,
        textureSamplers: description.textureSamplers ?? {},
        attributes: description.attributes ?? {},
        varyings: description.varyings ?? {},
        isVertex: true,
        skipWorldTransform: description.skipWorldTransform ?? false,
        finalVariable: description.vertexFinalPosition,
        utilDeclarations: description.utilDeclarations,
        mainSource: description.vertexMain,
      })

      const fragmentSource = buildShaderSource({
        uniforms: description.uniforms ?? {},
        textures: textures,
        textureSamplers: description.textureSamplers ?? {},
        varyings: description.varyings ?? {},
        isVertex: false,
        skipWorldTransform: description.skipWorldTransform ?? false,
        finalVariable: [description.fragmentFinalColor, description.fragmentEntityId],
        utilDeclarations: description.utilDeclarations,
        mainSource: description.fragmentMain,
      })

      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
      gl.shaderSource(vertexShader, vertexSource)
      gl.compileShader(vertexShader)

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(fragmentShader, fragmentSource)
      gl.compileShader(fragmentShader)

      const program = gl.createProgram()!
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      if (!isCompilationOk(gl, program, vertexShader, fragmentShader)) {
        throw new Error('Compilation failed')
      }

      const attributes = getAllAttributes(gl, program)
      const uniforms = getAllUniforms(gl, program)

      gl.useProgram(program)
      for (const name of Object.keys(description.textureSamplers ?? {})) {
        const location = uniforms[name]
        if (!location) throw new Error()
        const bindingPoint = (textures[name]?.spec as TextureSpecification)?.textureSlot
        if (bindingPoint == null) throw new Error()
        gl.uniform1i(location, bindingPoint)
      }
      gl.useProgram(null)

      return [
        entry[0],
        {
          attributes,
          uniforms,
          spec: description,
          use() {
            gl.useProgram(program)
          },
          unsafeUniformLocations: uniforms,
          getPointer() {
            return program
          },
        },
      ]
    }),
  ) as any satisfies Implementation<S>['programs']
}

function createBuffers<S extends AnySpec<S>>(gl: WebGL2RenderingContext, s: S) {
  return Object.fromEntries(
    Object.entries(s.buffers ?? {}).map(entry => {
      const description = entry[1]! as AnySpec<S>['buffers'][keyof AnySpec<S>['buffers']]
      const glBuffer = gl.createBuffer()

      const target = description.element === true ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER
      const usage = description.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_READ

      return [
        entry[0],
        {
          unsafePointer: glBuffer,
          spec: description,
          setContent: (value: TypedArray) => {
            gl.bindBuffer(target, glBuffer)
            gl.bufferData(target, value, usage)
            gl.bindBuffer(target, null)
          },
        },
      ]
    }),
  ) as any satisfies Implementation<S>['buffers']
}

function createTextures<S extends AnySpec<S>>(gl: WebGL2RenderingContext, s: S) {
  return Object.fromEntries(
    Object.entries(s.textures ?? {}).map(entry => {
      const description = entry[1]! as AnySpec<S>['textures'][keyof AnySpec<S>['textures']]
      const glTexture = gl.createTexture()

      const target = gl.TEXTURE_2D
      const glSlot = gl.TEXTURE0 + description.textureSlot

      gl.activeTexture(glSlot)
      gl.bindTexture(target, glTexture)
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

      // creating texture or setting content leaves this texture bound to this slot
      // this is intended behavior as we use only single texture per slot

      const internalFormat = description.float32 ? gl.R32F : gl.R8UI
      const format = description.float32 ? gl.RED : gl.RED_INTEGER
      const type = description.float32 ? gl.FLOAT : gl.UNSIGNED_BYTE

      return [
        entry[0],
        {
          unsafePointer: glTexture,
          spec: description,
          setContentSquare: (value: TypedArray, sizeInOneDimension: number) => {
            gl.activeTexture(glSlot)
            gl.bindTexture(target, glTexture)
            gl.texImage2D(target, 0, internalFormat, sizeInOneDimension, sizeInOneDimension, 0, format, type, value)
          },
          setContent2D: (value: TypedArray, width: number, height: number) => {
            gl.activeTexture(glSlot)
            gl.bindTexture(target, glTexture)
            gl.texImage2D(target, 0, internalFormat, width, height, 0, format, type, value)
          },
        },
      ]
    }),
  ) as any satisfies Implementation<S>['textures']
}
