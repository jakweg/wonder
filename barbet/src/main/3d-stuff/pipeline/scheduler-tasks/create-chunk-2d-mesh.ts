import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import { World } from '@game/world/world'
import { Environment } from '.'
import { Task, TaskResult, TaskType } from '../work-scheduler'

function computeAOOcclusionValue(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) {
    return 3
  }
  return (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0)
}

const createVertexBufferForTopLayer = (chunkX: number, chunkY: number, world: World) => {
  const numbers: number[] = []

  function getAoForTopVertex(thisBlockHeight: number, vx: number, vz: number) {
    const side1 = world.getHighestBlockHeight_orElse(vx - 1, vz, 0) > thisBlockHeight
    const side2 = world.getHighestBlockHeight_orElse(vx, vz - 1, 0) > thisBlockHeight
    const corner = world.getHighestBlockHeight_orElse(vx - 1, vz - 1, 0) > thisBlockHeight

    const aoTwoBits = computeAOOcclusionValue(side1, side2, corner) & 0b11
    return aoTwoBits // > 0 ? 0b11 : 0
  }

  const getAoByteForBlock = (thisBlockHeight: number, x: number, z: number) => {
    const aoByte =
      (getAoForTopVertex(thisBlockHeight, x + 1, z) << 6) | // Vertex 3 (NE)
      (getAoForTopVertex(thisBlockHeight, x + 1, z + 1) << 4) | // Vertex 2 (SE)
      (getAoForTopVertex(thisBlockHeight, x, z + 1) << 2) | // Vertex 1 (SW)
      (getAoForTopVertex(thisBlockHeight, x, z) << 0) // Vertex 0 (NW)

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

const createVertexBufferForSideLayers = (chunkX: number, chunkY: number, world: World) => {
  const numbers: number[] = []

  function isSolid(bx: number, by: number, bz: number): boolean {
    // Assuming heights are integers. If y is 5, block 4 is solid, but 5 is not.
    // So, we check if by < height.
    return by < world.getHighestBlockHeight_orElse(bx, bz, 0)
  }

  /**
   * Calculates the AO occlusion value (0, 1, 2, or 3) for a vertex.
   * 0 = fully lit, 3 = fully occluded.
   * @param side1 - Is the first adjacent side block solid? (boolean)
   * @param side2 - Is the second adjacent side block solid? (boolean)
   * @param corner - Is the diagonal corner block solid? (boolean)
   */
  function computeAOOcclusionValue(side1: boolean, side2: boolean, corner: boolean): number {
    // Convert booleans to 0 or 1
    const s1 = side1 ? 1 : 0
    const s2 = side2 ? 1 : 0
    const c = corner ? 1 : 0

    // If both sides are solid, the corner is occluded anyway.
    if (s1 && s2) {
      return 3
    }

    // Otherwise, it's the sum of all three.
    return s1 + s2 + c
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
        let less, more, bitFlags, needsFlip, aoSampleX

        if (nextXBlockHeight < thisBlockHeight) {
          less = nextXBlockHeight
          more = thisBlockHeight
          bitFlags = 0b1_0_00_0000
          needsFlip = true
          aoSampleX = x + 1
        } else {
          less = thisBlockHeight
          more = nextXBlockHeight
          bitFlags = 0b1_1_00_0000
          needsFlip = false
          aoSampleX = x
        }

        for (let height = less; height < more; ++height) {
          const s1_bb = isSolid(aoSampleX, height, z - 1)
          const s2_bb = isSolid(aoSampleX, height - 1, z)
          const c_bb = isSolid(aoSampleX, height - 1, z - 1)
          const ao_bb = computeAOOcclusionValue(s1_bb, s2_bb, c_bb)

          const s1_bf = isSolid(aoSampleX, height, z + 1)
          const s2_bf = isSolid(aoSampleX, height - 1, z)
          const c_bf = isSolid(aoSampleX, height - 1, z + 1)
          const ao_bf = computeAOOcclusionValue(s1_bf, s2_bf, c_bf)

          const s1_tf = isSolid(aoSampleX, height, z + 1)
          const s2_tf = isSolid(aoSampleX, height + 1, z)
          const c_tf = isSolid(aoSampleX, height + 1, z + 1)
          const ao_tf = computeAOOcclusionValue(s1_tf, s2_tf, c_tf)

          const s1_tb = isSolid(aoSampleX, height, z - 1)
          const s2_tb = isSolid(aoSampleX, height + 1, z)
          const c_tb = isSolid(aoSampleX, height + 1, z - 1)
          const ao_tb = computeAOOcclusionValue(s1_tb, s2_tb, c_tb)

          const ao1 = ao_bf
          const ao2 = ao_tf
          const ao3 = ao_tb
          const ao4 = ao_bb

          let aoByte
          if (needsFlip) {
            // flipped: bottom+z, bottom-z, top-z, top+z
            aoByte = (ao1 << 6) | (ao4 << 4) | (ao3 << 2) | (ao2 << 0)
          } else {
            // not flipped: bottom+z, top+z, top-z, bottom-z
            aoByte = (ao1 << 6) | (ao2 << 4) | (ao3 << 2) | (ao4 << 0)
          }

          numbers.push(bitFlags | ((quadIndexWithinChunk >> 8) & 0b1111), quadIndexWithinChunk & 0xff, height, aoByte)
        }
      }

      if (nextZBlockHeight !== thisBlockHeight) {
        // generate sides for Z axis
        let less, more, bitFlags, needsFlip, aoSampleZ

        if (nextZBlockHeight < thisBlockHeight) {
          less = nextZBlockHeight
          more = thisBlockHeight
          bitFlags = 0b0_1_00_0000
          needsFlip = true
          aoSampleZ = z + 1
        } else {
          less = thisBlockHeight
          more = nextZBlockHeight
          bitFlags = 0b0_0_00_0000
          needsFlip = false
          aoSampleZ = z
        }

        for (let height = less; height < more; ++height) {
          const s1_bl = isSolid(x - 1, height, aoSampleZ)
          const s2_bl = isSolid(x, height - 1, aoSampleZ)
          const c_bl = isSolid(x - 1, height - 1, aoSampleZ)
          const ao_bl = computeAOOcclusionValue(s1_bl, s2_bl, c_bl)

          const s1_br = isSolid(x + 1, height, aoSampleZ)
          const s2_br = isSolid(x, height - 1, aoSampleZ)
          const c_br = isSolid(x + 1, height - 1, aoSampleZ)
          const ao_br = computeAOOcclusionValue(s1_br, s2_br, c_br)

          const s1_tr = isSolid(x + 1, height, aoSampleZ)
          const s2_tr = isSolid(x, height + 1, aoSampleZ)
          const c_tr = isSolid(x + 1, height + 1, aoSampleZ)
          const ao_tr = computeAOOcclusionValue(s1_tr, s2_tr, c_tr)

          const s1_tl = isSolid(x - 1, height, aoSampleZ)
          const s2_tl = isSolid(x, height + 1, aoSampleZ)
          const c_tl = isSolid(x - 1, height + 1, aoSampleZ)
          const ao_tl = computeAOOcclusionValue(s1_tl, s2_tl, c_tl)

          const ao1 = ao_br
          const ao2 = ao_tr
          const ao3 = ao_tl
          const ao4 = ao_bl

          let aoByte
          if (needsFlip) {
            // Flipped order: bottom+x, bottom-x, top-x, top+x
            aoByte = (ao1 << 6) | (ao4 << 4) | (ao3 << 2) | (ao2 << 0)
          } else {
            // Non-flipped order: bottom+x, top+x, top-x, bottom-x
            aoByte = (ao1 << 6) | (ao2 << 4) | (ao3 << 2) | (ao4 << 0)
          }

          // --- Push data ---
          numbers.push(bitFlags | ((quadIndexWithinChunk >> 8) & 0b1111), quadIndexWithinChunk & 0xff, height, aoByte)
        }
      }
    }
  }

  return new Uint8Array(numbers)
}

export default async (env: Environment, task: Task & { type: TaskType.Create2dChunkMesh }): Promise<TaskResult> => {
  const world = env.world
  const i = (task.chunkIndex / world.sizeLevel) | 0
  const j = task.chunkIndex % world.sizeLevel | 0

  env.mutexEnter()
  const recreationId = world.chunkModificationIds[task.chunkIndex]!
  const top = createVertexBufferForTopLayer(i, j, world)
  const sides = createVertexBufferForSideLayers(i, j, world)
  env.mutexExit()

  return {
    type: TaskType.Create2dChunkMesh,
    chunkIndex: task.chunkIndex,
    top,
    sides,
    recreationId,
  }
}
