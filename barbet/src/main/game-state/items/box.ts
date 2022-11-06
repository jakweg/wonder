import { MainRenderer } from '@3d/main-renderer'
import lazy from '@seampan/lazy'
import { MeshBuffer } from '.'

const rootVertexes = [
  -0.5, -0.5, -0.5, 0b010001, 0.5, -0.5, -0.5, 0b010100, 0.5, -0.5, 0.5, 0b100101, -0.5, -0.5, 0.5, 0b010110,

  -0.5, 0.5, -0.5, 0, 0.5, 0.5, -0.5, 0b101110, 0.5, 0.5, 0.5, 0, -0.5, 0.5, 0.5, 0b000101,
]

const vertexes = /* @__PURE__ */ lazy(
  () =>
    new Float32Array(
      rootVertexes.map((e, i) => {
        if (i % 4 === 3) return e // flags
        e += 0.5
        e *= 0.7

        if (i % 2 === 0) e += 0.15 // x, z

        return e
      }),
    ),
)

const vertexesInHand = /* @__PURE__ */ lazy(
  () =>
    new Float32Array(
      rootVertexes.map((e, i) => {
        if (i % 4 === 3) return e // flags
        e *= 0.9
        return e
      }),
    ),
)

const elements = /* @__PURE__ */ lazy(
  () =>
    new Uint8Array([
      // bottom
      1, 2, 0, 2, 3, 0,
      // bottom front
      0, 4, 1, 4, 5, 1,
      // bottom right side
      1, 5, 2, 5, 6, 2,
      // bottom left side
      0, 3, 7, 4, 0, 7,
      // bottom back
      2, 6, 3, 6, 7, 3,
      // top
      4, 7, 5, 7, 6, 5,
    ]),
)

export const createMeshBuffer = (renderer: MainRenderer): MeshBuffer => {
  const array = renderer.createBuffer(true, false)
  array.setContent(vertexesInHand())
  const indices = renderer.createBuffer(false, false)
  indices.setContent(elements())
  return { array, indices, trianglesToRender: elements().length | 0 }
}

export const appendToMesh = (x: number, y: number, z: number, vertexData: number[], elementsData: number[]) => {
  const vertexCountBeforeAdd = (vertexData.length / 4) | 0
  const computedVertexes = vertexes()
  for (let i = 0, s = computedVertexes.length; i < s; ) {
    const vx = computedVertexes[i++]! + x
    const vy = computedVertexes[i++]! + y
    const vz = computedVertexes[i++]! + z
    const flags = computedVertexes[i++]!
    vertexData.push(vx, vy, vz, flags)
  }

  for (const index of elements()) {
    elementsData.push(index + vertexCountBeforeAdd)
  }
}
