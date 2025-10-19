import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import { World } from '@game/world/world'
import { Environment } from '.'
import { Task, TaskResult, TaskType } from '../work-scheduler'

const createVertexBufferForTopLayer = (chunkX: number, chunkY: number, world: World) => {
  const numbers: number[] = []

  const getAoByteForBlock = (thisBlockHeight: number, x: number, z: number) => {
    const y_px = world.getHighestBlockHeight_orElse(x + 1, z, thisBlockHeight) > thisBlockHeight ? 1 : 0
    const y_pz = world.getHighestBlockHeight_orElse(x, z + 1, thisBlockHeight) > thisBlockHeight ? 1 : 0

    const y_nx = world.getHighestBlockHeight_orElse(x - 1, z, thisBlockHeight) > thisBlockHeight ? 1 : 0
    const y_nz = world.getHighestBlockHeight_orElse(x, z - 1, thisBlockHeight) > thisBlockHeight ? 1 : 0

    const y_px_pz = world.getHighestBlockHeight_orElse(x + 1, z + 1, thisBlockHeight) > thisBlockHeight ? 1 : 0
    const y_nx_nz = world.getHighestBlockHeight_orElse(x - 1, z - 1, thisBlockHeight) > thisBlockHeight ? 1 : 0

    const y_nx_pz = world.getHighestBlockHeight_orElse(x - 1, z + 1, thisBlockHeight) > thisBlockHeight ? 1 : 0
    const y_px_nz = world.getHighestBlockHeight_orElse(x + 1, z - 1, thisBlockHeight) > thisBlockHeight ? 1 : 0

    const o__x__z = (y_nx + y_nz + y_nx_nz) & 0b11
    const o_px_pz = (y_px + y_pz + y_px_pz) & 0b11
    const o_px__z = (y_px + y_nz + y_px_nz) & 0b11
    const o__x_pz = (y_nx + y_pz + y_nx_pz) & 0b11

    const aoByte = (o__x__z << 0) | (o_px_pz << 4) | (o_px__z << 6) | (o__x_pz << 2)

    return aoByte
  }

  for (let cz = 0; cz < GENERIC_CHUNK_SIZE; ++cz) {
    for (let cx = 0; cx < GENERIC_CHUNK_SIZE; ++cx) {
      const x = chunkX * GENERIC_CHUNK_SIZE + cx
      const z = chunkY * GENERIC_CHUNK_SIZE + cz

      const thisBlockHeight = world.getHighestBlockHeight_unsafe(x, z)

      const aoByte = getAoByteForBlock(thisBlockHeight, x, z)

      numbers.push(aoByte)
    }
  }

  return new Uint8Array(numbers)
}

const createMeshForSideLayers = (chunkX: number, chunkY: number, world: World) => {
  const getAoByteForVerticalXPlainVertex = (thisBlockHeight: number, x: number, z: number, positiveX: boolean) => {
    const y_nz = world.getHighestBlockHeight_orElse(x + (!positiveX ? -1 : 0), z - 1, -1)
    const y_pz = world.getHighestBlockHeight_orElse(x + (!positiveX ? -1 : 0), z, -1)

    const o1 = y_nz > thisBlockHeight ? 1 : 0
    const o2 = y_pz > thisBlockHeight ? 1 : 0
    const o3 = y_nz >= thisBlockHeight ? 1 : 0
    const o4 = y_pz >= thisBlockHeight ? 1 : 0

    return (o1 + o2 + o3 + o4) & 0b11
  }
  const getAoByteForVerticalZPlainVertex = (thisBlockHeight: number, x: number, z: number, positiveZ: boolean) => {
    const y_nx = world.getHighestBlockHeight_orElse(x - 1, z + (positiveZ ? -1 : 0), -1)
    const y_px = world.getHighestBlockHeight_orElse(x, z + (positiveZ ? -1 : 0), -1)

    const o1 = y_nx > thisBlockHeight ? 1 : 0
    const o2 = y_px > thisBlockHeight ? 1 : 0
    const o3 = y_nx >= thisBlockHeight ? 1 : 0
    const o4 = y_px >= thisBlockHeight ? 1 : 0

    return (o1 + o2 + o3 + o4) & 0b11
  }

  const indexes: number[] = []
  // map of vertexes where key is `${x}-${y}-${z}`
  const vertexes = new Map<string, { x: number; y: number; z: number; ao: number; index: number }>()

  const createVertexIfNeeded = (
    x: number,
    y: number,
    z: number,
    isX: boolean,
    isPositive: boolean,
  ): Parameters<(typeof vertexes)['set']>[1] => {
    const key = `${x}-${y}-${z}-${crypto.randomUUID()}`
    let got = vertexes.get(key)
    if (got === undefined) {
      const ao = isX
        ? getAoByteForVerticalXPlainVertex(y, x, z, isPositive)
        : getAoByteForVerticalZPlainVertex(y, x, z, isPositive)

      const index = vertexes.size
      got = {
        index,
        x,
        y,
        z,
        ao,
      } satisfies ReturnType<(typeof vertexes)['get']>
      vertexes.set(key, got)
    }
    return got!
  }

  let quadIndexWithinChunk = -1
  for (let cz = 0; cz < GENERIC_CHUNK_SIZE; ++cz) {
    for (let cx = 0; cx < GENERIC_CHUNK_SIZE; ++cx) {
      quadIndexWithinChunk++
      const x = chunkX * GENERIC_CHUNK_SIZE + cx
      const z = chunkY * GENERIC_CHUNK_SIZE + cz

      const thisBlockHeight = world.getHighestBlockHeight_unsafe(x, z)
      const nextXBlockHeight = world.getHighestBlockHeight_orElse(x + 1, z, thisBlockHeight)
      const nextZBlockHeight = world.getHighestBlockHeight_orElse(x, z + 1, thisBlockHeight)

      if (nextXBlockHeight !== thisBlockHeight) {
        let less, more, needsFlip
        if (nextXBlockHeight < thisBlockHeight) {
          less = nextXBlockHeight
          more = thisBlockHeight
          needsFlip = true
        } else {
          less = thisBlockHeight
          more = nextXBlockHeight
          needsFlip = false
        }

        for (let height = less; height < more; ++height) {
          const v0 = createVertexIfNeeded(x + 1, height, z, true, needsFlip)
          const v1 = createVertexIfNeeded(x + 1, height, z + 1, true, needsFlip)
          const v2 = createVertexIfNeeded(x + 1, height + 1, z + 1, true, needsFlip)
          const v3 = createVertexIfNeeded(x + 1, height + 1, z, true, needsFlip)

          if (needsFlip) {
            indexes.push(v2.index, v1.index, v0.index, v2.index, v0.index, v3.index)
          } else {
            indexes.push(v0.index, v1.index, v2.index, v0.index, v2.index, v3.index)
          }
        }
      }

      if (nextZBlockHeight !== thisBlockHeight) {
        let less, more, needsFlip
        if (nextZBlockHeight < thisBlockHeight) {
          less = nextZBlockHeight
          more = thisBlockHeight
          needsFlip = true
        } else {
          less = thisBlockHeight
          more = nextZBlockHeight
          needsFlip = false
        }

        for (let height = less; height < more; ++height) {
          const v0 = createVertexIfNeeded(x, height, z + 1, false, !needsFlip)
          const v1 = createVertexIfNeeded(x + 1, height, z + 1, false, !needsFlip)
          const v2 = createVertexIfNeeded(x + 1, height + 1, z + 1, false, !needsFlip)
          const v3 = createVertexIfNeeded(x, height + 1, z + 1, false, !needsFlip)

          if (needsFlip) {
            indexes.push(v0.index, v1.index, v2.index, v0.index, v2.index, v3.index)
          } else {
            indexes.push(v2.index, v1.index, v0.index, v2.index, v0.index, v3.index)
          }
        }
      }
    }
  }

  const vertexesBuffer = new Uint8Array(vertexes.size * 4)
  let i = 0
  for (const vertex of vertexes.values()) {
    vertexesBuffer[i++] = vertex.x
    vertexesBuffer[i++] = vertex.y
    vertexesBuffer[i++] = vertex.z
    vertexesBuffer[i++] = vertex.ao
  }
  return {
    vertexes: vertexesBuffer,
    indexes: new Uint32Array(indexes),
  }
}

export default async (env: Environment, task: Task & { type: TaskType.Create2dChunkMesh }): Promise<TaskResult> => {
  const world = env.world
  const i = (task.chunkIndex / world.sizeLevel) | 0
  const j = task.chunkIndex % world.sizeLevel | 0

  env.mutexEnter()
  const recreationId = world.chunkModificationIds[task.chunkIndex]!
  const top = createVertexBufferForTopLayer(i, j, world)
  const mesh = createMeshForSideLayers(i, j, world)
  env.mutexExit()

  return {
    type: TaskType.Create2dChunkMesh,
    chunkIndex: task.chunkIndex,
    top,
    sidesVertexes: mesh.vertexes,
    sidesElements: mesh.indexes,
    recreationId,
  }
}
