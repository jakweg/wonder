import { AttrType } from '@3d/gpu-resources/program'
import { TextureSlot } from '@3d/texture-slot-counter'

type AttributeSpecification = {
  disabled?: boolean
  count: number
  divisor?: number
} & (
  | { type: AttrType.Float } // float can't be normalized
  | { type: Exclude<AttrType, AttrType.Float>; normalize?: boolean }
)

interface Spec<
  B extends string = string,
  P extends string = string,
  U extends string = string,
  T extends string = string,
  AM extends Record<P, string> = any,
> {
  buffers?: Record<B, { dynamic: boolean; element?: true }>
  programs?: Record<
    P,
    {
      vertexMain: string
      vertexFinalPosition: string

      fragmentMain: string
      fragmentFinalColor: string

      attributes?: Record<AM[P], AttributeSpecification>

      varyings?: Record<string, { type: string }>

      uniforms?: Record<U, { type: string }>
      textureSamplers?: Record<T, {}>
    }
  >
  textures?: Record<T, { textureSlot: TextureSlot }>
}

type Implementation<S extends Spec> = {
  use: () => void
  stop: () => void
  buffers: Record<keyof S['buffers'], { setContent: (value: ArrayBuffer) => void }>
  programs: Record<keyof S['programs'], { use: () => void }>
  textures: Record<keyof S['textures'], { setContent: (value: ArrayBuffer, sizeInOneDimension: number) => void }>
}

const s = {
  buffers: {
    indices: { dynamic: true, element: true },
    position: { dynamic: true },
    color: { dynamic: true },
  },
  programs: {
    default: {
      vertexMain: ``,
      fragmentMain: ``,
      vertexFinalPosition: ``,
      fragmentFinalColor: ``,

      attributes: {},

      uniforms: {
        hello: { type: 'float' },
      },
      textureSamplers: {
        heightMap: {},
        terrainType: {},
      },
    },
  },
  textures: {
    abd: { textureSlot: 0 },
  },
} satisfies Spec

export const createFromSpec = <S extends Spec>(gl: WebGL2RenderingContext, s: S): Implementation<S> => {
  const buffers = Object.fromEntries(
    Object.entries(s.buffers ?? {}).map(([name, description]) => {
      const glBuffer = gl.createBuffer()

      const target = description.element === true ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER
      const usage = description.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_READ

      return [
        name,
        {
          setContent: (value: ArrayBuffer) => {
            gl.bindBuffer(target, glBuffer)
            gl.bufferData(target, value, usage)
            gl.bindBuffer(target, null)
          },
        } satisfies Implementation<S>['buffers'][any],
      ]
    }),
  )

  return {
    buffers,
  }
}

// const implementation = createFromSpec(null!, s)

// const getBufferNames = <B extends string>(s: Spec<B>): Record<B, string> => {
//   return null
// }

// const a = getBufferNames(s)
// a.color
