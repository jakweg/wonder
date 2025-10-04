import { VersionHeader, PrecisionHeader, GlobalUniformBlockDeclaration } from '@3d/common-shader'
import { TextureSlot } from '@3d/texture-slot-counter'
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
  disabled?: boolean
  count: number
  divisor?: number
  bindTo: Record<B, true>
} & (
  | { type: AttrType.Float } // float can't be normalized
  | { type: Exclude<AttrType, AttrType.Float>; normalize?: boolean }
)
type UniformSpecification = { type: string }
type VaryingSpecification = { type: string; flat?: boolean }
type TextureSamplerSpecification = {}

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

      fragmentMain: (variables: Record<NeverIfAny<T> | NeverIfAny<U> | NeverIfAny<AM[P]> | string, string>) => string
      fragmentFinalColor: string

      attributes?: Record<AM[P], AttributeSpecification<B>>

      varyings?: Record<string, VaryingSpecification>

      uniforms?: Record<U, UniformSpecification>
      textureSamplers?: Record<T, TextureSamplerSpecification>
    }
  >
  textures?: Record<T, { textureSlot: TextureSlot }>
}

type AnySpec<
  S extends Spec<keyof S['buffers'], keyof S['programs'], keyof S['programs'][any]['uniforms'], keyof S['textures']>,
> = Spec<keyof S['buffers'], keyof S['programs'], keyof S['programs'][any]['uniforms'], keyof S['textures']>

type Implementation<S extends AnySpec<S>> = {
  use: () => void
  stop: () => void
  buffers: Record<keyof S['buffers'], { setContent: (value: TypedArray) => void }>
  programs: Record<keyof S['programs'], { use: () => void; getPointer(): WebGLProgram }>
  textures: Record<keyof S['textures'], { setContent: (value: TypedArray, sizeInOneDimension: number) => void }>
}

export const createFromSpec = <S extends AnySpec<S>>(gl: WebGL2RenderingContext, s: S): Implementation<S> => {
  const buffers = createBuffers(gl, s)
  const textures = createTextures(gl, s)
  const programs = createPrograms(gl, s)

  const vao = gl.createVertexArray()

  return {
    use() {
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

function buildShaderSource(params: {
  isVertex: boolean
  uniforms: Record<string, UniformSpecification>
  textureSamplers: Record<string, TextureSamplerSpecification>
  attributes?: Record<string, AttributeSpecification>
  varyings: Record<string, VaryingSpecification>
  mainSource: (variables: any) => string
  utilDeclarations: any
  finalVariable: string
}) {
  const availableVariables: any = {}
  const parts: string[] = []
  parts.push(VersionHeader(), PrecisionHeader(), GlobalUniformBlockDeclaration())

  for (const [n, u] of Object.entries(params.uniforms)) {
    parts.push('uniform ', u.type, ' u_', n, ';\n')
    availableVariables[n] = 'u_' + n
  }

  for (const [n, u] of Object.entries(params.textureSamplers)) {
    parts.push('uniform ', 'usampler2D', ' u_', n, ';\n')
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
    parts.push('out vec3 finalFinalColor;')
  }

  if (typeof params.utilDeclarations === 'string') {
    parts.push(params.utilDeclarations)
  } else if (params.utilDeclarations) {
    parts.push(params.utilDeclarations(safeAvailableVariables))
  }

  parts.push('void main() {\n', params.mainSource(safeAvailableVariables))
  if (params.isVertex) {
    parts.push('gl_Position = u_combinedMatrix * vec4(', params.finalVariable, ', 1);\ngl_PointSize = 10.0;\n}\n')
  } else {
    parts.push('finalFinalColor = ', params.finalVariable, ';\n}\n')
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

// function useAttributes(
//   attributes: Readonly<Partial<{ [key in A | ('_' | '__' | '___')]: AttributeSpecification }>>,
// ): void {
//   const gl = this.gl
//   const entries = Object.entries(attributes) as [A, AttributeSpecification][]

//   const totalSize = entries.map(([_, v]) => v.count * getBytesSize(v.type))['reduce']((a, b) => a + b, 0)

//   let offset = 0
//   for (const [key, attribute] of entries) {
//     const index = this.attributes[key]
//     const type = attribute.type
//     if (index !== undefined) {
//       gl.enableVertexAttribArray(index)
//       if ((attribute as any).normalize === undefined ? isInt(type) : false)
//         gl.vertexAttribIPointer(index, attribute.count, getGlValue(gl, type), totalSize, offset)
//       else
//         gl.vertexAttribPointer(
//           index,
//           attribute.count,
//           getGlValue(gl, type),
//           (attribute as any).normalize ?? false,
//           totalSize,
//           offset,
//         )

//       if (attribute.divisor !== undefined) gl.vertexAttribDivisor(index, attribute.divisor)
//     }
//     offset += attribute.count * getBytesSize(type)
//   }
// }

function createPrograms<S extends AnySpec<S>>(gl: WebGL2RenderingContext, s: S) {
  return Object.fromEntries(
    Object.entries(s.programs ?? {}).map(entry => {
      const description = entry[1]! as AnySpec<S>['programs'][keyof AnySpec<S>['programs']]

      const vertexSource = buildShaderSource({
        uniforms: description.uniforms ?? {},
        textureSamplers: description.textureSamplers ?? {},
        attributes: description.attributes ?? {},
        varyings: description.varyings ?? {},
        isVertex: true,
        finalVariable: description.vertexFinalPosition,
        utilDeclarations: description.utilDeclarations,
        mainSource: description.vertexMain,
      })

      const fragmentSource = buildShaderSource({
        uniforms: description.uniforms ?? {},
        textureSamplers: description.textureSamplers ?? {},
        varyings: description.varyings ?? {},
        isVertex: false,
        finalVariable: description.fragmentFinalColor,
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

      return [
        entry[0],
        {
          use() {
            throw new Error('TODO')
          },
          getPointer() {
            return program
          },
        } satisfies Implementation<S>['programs'][any],
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
      gl.bindTexture(target, null)

      return [
        entry[0],
        {
          setContent: (value: TypedArray, sizeInOneDimension: number) => {
            gl.bindTexture(target, glTexture)
            gl.texImage2D(
              target,
              0,
              gl.R8UI,
              sizeInOneDimension,
              sizeInOneDimension,
              0,
              gl.RED_INTEGER,
              gl.UNSIGNED_BYTE,
              value,
            )
            gl.bindTexture(target, null)
          },
        } satisfies Implementation<S>['textures'][any],
      ]
    }),
  ) as any satisfies Implementation<S>['textures']
}
